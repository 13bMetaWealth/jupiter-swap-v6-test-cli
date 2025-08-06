#!/usr/bin/env node

import { CoreSwap } from './core-swap.js';
import fs from 'fs';
import path from 'path';

class PerformanceProfiler {
    constructor(options = {}) {
        this.testRuns = options.testRuns || 5;
        this.results = [];
        this.summary = {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            metrics: {
                totalTime: [],
                quoteTime: [],
                buildTime: [],
                simulateTime: [],
                sendTime: [],
                confirmTime: [],
                computeUnits: [],
                rpcLatency: []
            },
            failures: []
        };
        
        // Track custom timing
        this.timers = {};
    }

    startTimer(name) {
        this.timers[name] = process.hrtime.bigint();
    }

    endTimer(name) {
        if (this.timers[name]) {
            const elapsed = Number(process.hrtime.bigint() - this.timers[name]) / 1e6; // Convert to ms
            delete this.timers[name];
            return elapsed;
        }
        return 0;
    }

    async measureRPCLatency(connection) {
        const start = process.hrtime.bigint();
        try {
            await connection.getSlot();
            return Number(process.hrtime.bigint() - start) / 1e6; // ms
        } catch (error) {
            console.error('Failed to measure RPC latency:', error.message);
            return -1;
        }
    }

    async runSingleTest(testNumber, withPriorityFee = false) {
        console.log(`\n📊 Starting Performance Test ${testNumber}/${this.testRuns} ${withPriorityFee ? '(with priority fee)' : '(no priority fee)'}`);
        console.log('='.repeat(80));
        
        const testResult = {
            testNumber,
            withPriorityFee,
            timestamp: new Date().toISOString(),
            success: false,
            error: null,
            metrics: {}
        };

        try {
            const swapper = new CoreSwap({ includeDetailedBalance: true });
            
            // Measure RPC latency
            testResult.metrics.rpcLatency = await this.measureRPCLatency(swapper.connection);
            console.log(`🌐 RPC Latency: ${testResult.metrics.rpcLatency.toFixed(2)}ms`);

            // Override console.time and console.timeEnd to capture metrics
            const originalConsoleTime = console.time;
            const originalConsoleTimeEnd = console.timeEnd;
            const timeMeasurements = {};
            
            console.time = (label) => {
                timeMeasurements[label] = process.hrtime.bigint();
            };
            
            console.timeEnd = (label) => {
                if (timeMeasurements[label]) {
                    const elapsed = Number(process.hrtime.bigint() - timeMeasurements[label]) / 1e6; // ms
                    testResult.metrics[label] = elapsed;
                    console.log(`${label}: ${elapsed.toFixed(3)}ms`);
                    delete timeMeasurements[label];
                }
            };

            // Store the original simulateTransaction to capture compute units
            const originalSimulateTransaction = swapper.connection.simulateTransaction.bind(swapper.connection);
            swapper.connection.simulateTransaction = async (transaction, options) => {
                const result = await originalSimulateTransaction(transaction, options);
                if (result?.value?.unitsConsumed) {
                    testResult.metrics.computeUnits = result.value.unitsConsumed;
                    console.log(`💻 Compute Units Consumed: ${result.value.unitsConsumed.toLocaleString()}`);
                }
                return result;
            };

            // Run the swap
            const priorityFee = withPriorityFee ? 5000 : 0;
            this.startTimer('totalSwapTime');
            
            const result = await swapper.performSwap({ 
                priorityFeeMicroLamports: priorityFee 
            });
            
            testResult.metrics.totalSwapTime = this.endTimer('totalSwapTime');
            testResult.success = true;
            testResult.signature = result.signature;
            testResult.inputAmount = result.inputAmount;
            testResult.outputAmount = result.outputAmount;

            // Restore original console methods
            console.time = originalConsoleTime;
            console.timeEnd = originalConsoleTimeEnd;

            console.log(`✅ Test ${testNumber} completed successfully in ${testResult.metrics.totalSwapTime.toFixed(2)}ms`);
            
        } catch (error) {
            testResult.success = false;
            testResult.error = error.message;
            console.log(`❌ Test ${testNumber} failed: ${error.message}`);
        }

        this.results.push(testResult);
        return testResult;
    }

    async runAllTests() {
        console.log(`🚀 Starting Jupiter Swap Performance Profiling`);
        console.log(`📈 Running ${this.testRuns} test iterations`);
        console.log(`⏰ Started at: ${new Date().toISOString()}\n`);

        // Run tests without priority fees
        for (let i = 1; i <= Math.ceil(this.testRuns / 2); i++) {
            await this.runSingleTest(i, false);
            // Small delay between tests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Run tests with priority fees
        for (let i = Math.ceil(this.testRuns / 2) + 1; i <= this.testRuns; i++) {
            await this.runSingleTest(i, true);
            // Small delay between tests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.generateSummary();
        this.saveResults();
        this.printReport();
    }

    generateSummary() {
        this.summary.totalRuns = this.results.length;
        this.summary.successfulRuns = this.results.filter(r => r.success).length;
        this.summary.failedRuns = this.results.filter(r => !r.success).length;
        this.summary.failures = this.results.filter(r => !r.success).map(r => ({
            testNumber: r.testNumber,
            error: r.error,
            withPriorityFee: r.withPriorityFee
        }));

        const successfulResults = this.results.filter(r => r.success);
        
        if (successfulResults.length > 0) {
            // Collect metrics from successful runs
            const metricKeys = ['totalSwapTime', 'getQuote', 'createSwapTransaction', 'simulateTransaction', 'sendTransaction', 'confirmTransaction', 'computeUnits', 'rpcLatency'];
            
            metricKeys.forEach(key => {
                const values = successfulResults
                    .map(r => r.metrics[key])
                    .filter(v => v !== undefined && v !== null && v >= 0);
                
                if (values.length > 0) {
                    this.summary.metrics[key] = {
                        min: Math.min(...values),
                        max: Math.max(...values),
                        avg: values.reduce((a, b) => a + b, 0) / values.length,
                        median: this.calculateMedian(values),
                        p95: this.calculatePercentile(values, 0.95),
                        count: values.length
                    };
                }
            });
        }
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[Math.max(0, index)];
    }

    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `performance-report-${timestamp}.json`;
        const filePath = path.join(process.cwd(), fileName);
        
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: this.summary,
            detailedResults: this.results
        };

        try {
            fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
            console.log(`💾 Detailed results saved to: ${fileName}`);
        } catch (error) {
            console.error(`Failed to save results: ${error.message}`);
        }
    }

    printReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 JUPITER SWAP PERFORMANCE BASELINE REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📈 Test Summary:`);
        console.log(`   Total Runs: ${this.summary.totalRuns}`);
        console.log(`   Successful: ${this.summary.successfulRuns} (${(this.summary.successfulRuns/this.summary.totalRuns*100).toFixed(1)}%)`);
        console.log(`   Failed: ${this.summary.failedRuns} (${(this.summary.failedRuns/this.summary.totalRuns*100).toFixed(1)}%)`);
        
        if (this.summary.failedRuns > 0) {
            console.log(`\n❌ Failure Analysis:`);
            this.summary.failures.forEach(failure => {
                console.log(`   Test ${failure.testNumber} ${failure.withPriorityFee ? '(w/ priority)' : '(no priority)'}: ${failure.error}`);
            });
        }

        console.log(`\n⏱️  Performance Metrics (ms):`);
        console.log('   ' + '-'.repeat(70));
        console.log('   Metric                   | Min     | Avg     | Median  | P95     | Max');
        console.log('   ' + '-'.repeat(70));
        
        const metricsToShow = [
            ['Total Swap Time', 'totalSwapTime'],
            ['Quote API Latency', 'getQuote'],  
            ['Build Transaction', 'createSwapTransaction'],
            ['Simulate Transaction', 'simulateTransaction'],
            ['Send Transaction', 'sendTransaction'],
            ['Confirm Transaction', 'confirmTransaction'],
            ['RPC Latency', 'rpcLatency']
        ];

        metricsToShow.forEach(([label, key]) => {
            const metric = this.summary.metrics[key];
            if (metric) {
                const row = `   ${label.padEnd(24)} | ${metric.min.toFixed(1).padStart(7)} | ${metric.avg.toFixed(1).padStart(7)} | ${metric.median.toFixed(1).padStart(7)} | ${metric.p95.toFixed(1).padStart(7)} | ${metric.max.toFixed(1).padStart(7)}`;
                console.log(row);
            }
        });

        // Compute Units
        const cuMetric = this.summary.metrics.computeUnits;
        if (cuMetric) {
            console.log(`\n💻 Compute Units Consumed:`);
            console.log(`   Min: ${cuMetric.min.toLocaleString()}`);
            console.log(`   Avg: ${Math.round(cuMetric.avg).toLocaleString()}`);
            console.log(`   Median: ${Math.round(cuMetric.median).toLocaleString()}`);
            console.log(`   Max: ${cuMetric.max.toLocaleString()}`);
        }

        console.log(`\n🔍 Bottleneck Analysis:`);
        this.analyzeBottlenecks();
        
        console.log(`\n💡 Optimization Recommendations:`);
        this.generateRecommendations();

        console.log('\n' + '='.repeat(80));
        console.log('Report completed at:', new Date().toISOString());
    }

    analyzeBottlenecks() {
        const metrics = this.summary.metrics;
        const bottlenecks = [];

        // Analyze which phase takes the longest
        const phases = [
            ['Quote API', 'getQuote'],
            ['Build Transaction', 'createSwapTransaction'], 
            ['Simulate', 'simulateTransaction'],
            ['Send', 'sendTransaction'],
            ['Confirm', 'confirmTransaction']
        ];

        const avgTimes = phases.map(([label, key]) => ({
            label,
            time: metrics[key]?.avg || 0
        })).sort((a, b) => b.time - a.time);

        console.log(`   Slowest phases (by avg time):`);
        avgTimes.slice(0, 3).forEach((phase, i) => {
            if (phase.time > 0) {
                console.log(`     ${i + 1}. ${phase.label}: ${phase.time.toFixed(1)}ms`);
            }
        });

        // Check for high variability
        phases.forEach(([label, key]) => {
            const metric = metrics[key];
            if (metric && metric.max > metric.avg * 3) {
                console.log(`   ⚠️  High variability in ${label}: ${metric.min.toFixed(1)}ms - ${metric.max.toFixed(1)}ms`);
            }
        });

        // Check RPC latency
        if (metrics.rpcLatency?.avg > 100) {
            console.log(`   ⚠️  High RPC latency: ${metrics.rpcLatency.avg.toFixed(1)}ms avg`);
        }
    }

    generateRecommendations() {
        const metrics = this.summary.metrics;
        const recommendations = [];

        // RPC recommendations
        if (metrics.rpcLatency?.avg > 100) {
            recommendations.push("Consider using a dedicated/premium RPC endpoint to reduce latency");
        }

        // Quote API recommendations
        if (metrics.getQuote?.avg > 2000) {
            recommendations.push("Quote API latency is high - consider implementing quote caching or using onlyDirectRoutes");
        }

        // Transaction building recommendations
        if (metrics.createSwapTransaction?.avg > 1000) {
            recommendations.push("Transaction building is slow - consider optimizing payload or using shared accounts");
        }

        // Confirmation recommendations  
        if (metrics.confirmTransaction?.avg > 30000) {
            recommendations.push("Transaction confirmation is slow - consider using priority fees or retry logic");
        }

        // Compute unit recommendations
        if (metrics.computeUnits?.avg > 200000) {
            recommendations.push("High compute unit usage - consider optimizing transaction complexity");
        }

        // Failure rate recommendations
        if (this.summary.failedRuns / this.summary.totalRuns > 0.1) {
            recommendations.push("High failure rate detected - investigate error patterns and implement better retry logic");
        }

        if (recommendations.length === 0) {
            console.log(`   ✅ Performance appears optimal - no major bottlenecks detected`);
        } else {
            recommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
    }
}

// Main execution
async function main() {
    try {
        const profiler = new PerformanceProfiler({ testRuns: 10 });
        await profiler.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error(`\n💥 Profiler failed: ${error.message}`);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Profiling interrupted by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Profiling terminated');
    process.exit(1);
});

// Export for use as module
export { PerformanceProfiler };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
