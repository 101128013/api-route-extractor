import type { Test, Assertion, TestResult, AssertionResult, RequestHistoryItem } from '../types';

export class TestService {
  private static STORAGE_KEY = 'api-extractor-tests';

  static getTests(): Test[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static getTestsForEndpoint(endpointId: string): Test[] {
    return this.getTests().filter(t => t.endpointId === endpointId && t.enabled);
  }

  static getTest(id: string): Test | null {
    return this.getTests().find(t => t.id === id) || null;
  }

  static saveTest(test: Test): void {
    const tests = this.getTests();
    const index = tests.findIndex(t => t.id === test.id);
    if (index >= 0) {
      tests[index] = test;
    } else {
      tests.push(test);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tests));
  }

  static deleteTest(id: string): void {
    const tests = this.getTests().filter(t => t.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tests));
  }

  static async runTest(test: Test, historyItem: RequestHistoryItem): Promise<TestResult> {
    const startTime = Date.now();
    const assertionResults: AssertionResult[] = [];

    try {
      // Run assertions
      for (const assertion of test.assertions) {
        const result = this.evaluateAssertion(assertion, historyItem);
        assertionResults.push(result);
      }

      // Run custom script if provided
      if (test.script) {
        try {
          const scriptResult = this.runTestScript(test.script, historyItem);
          if (!scriptResult.passed) {
            assertionResults.push({
              assertionId: 'script',
              passed: false,
              expected: 'Script to pass',
              actual: scriptResult.error || 'Script failed',
              error: scriptResult.error,
            });
          }
        } catch (error) {
          assertionResults.push({
            assertionId: 'script',
            passed: false,
            expected: 'Script to execute',
            actual: 'Script execution failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const allPassed = assertionResults.every(r => r.passed);
      const duration = Date.now() - startTime;

      return {
        testId: test.id,
        testName: test.name,
        passed: allPassed,
        assertions: assertionResults,
        duration,
      };
    } catch (error) {
      return {
        testId: test.id,
        testName: test.name,
        passed: false,
        assertions: assertionResults,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  static evaluateAssertion(assertion: Assertion, historyItem: RequestHistoryItem): AssertionResult {
    try {
      let actual: any;
      let passed = false;

      switch (assertion.type) {
        case 'status':
          actual = historyItem.response.status;
          passed = this.compareValues(actual, assertion.expected, assertion.operator || 'equals');
          break;

        case 'header':
          if (assertion.property) {
            const headerValue = historyItem.response.headers[assertion.property.toLowerCase()];
            actual = headerValue;
            passed = this.compareValues(actual, assertion.expected, assertion.operator || 'equals');
          } else {
            passed = false;
            actual = 'Header property not specified';
          }
          break;

        case 'body':
          if (assertion.path) {
            actual = this.getJsonPathValue(historyItem.response.body, assertion.path);
            passed = this.compareValues(actual, assertion.expected, assertion.operator || 'equals');
          } else {
            // Check if body contains expected value
            actual = historyItem.response.body;
            passed = this.compareValues(actual, assertion.expected, assertion.operator || 'contains');
          }
          break;

        case 'responseTime':
          actual = historyItem.response.duration;
          passed = this.compareValues(actual, assertion.expected, assertion.operator || 'lessThan');
          break;

        case 'custom':
          // Custom assertions are handled by script
          passed = false;
          actual = 'Custom assertion not evaluated';
          break;
      }

      return {
        assertionId: assertion.id,
        passed,
        expected: assertion.expected,
        actual,
        error: passed ? undefined : `Expected ${assertion.operator || 'equals'} ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actual)}`,
      };
    } catch (error) {
      return {
        assertionId: assertion.id,
        passed: false,
        expected: assertion.expected,
        actual: 'Error evaluating assertion',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return JSON.stringify(actual) === JSON.stringify(expected);
      case 'notEquals':
        return JSON.stringify(actual) !== JSON.stringify(expected);
      case 'contains':
        return String(actual).includes(String(expected));
      case 'matches':
        try {
          const regex = new RegExp(String(expected));
          return regex.test(String(actual));
        } catch {
          return false;
        }
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      default:
        return false;
    }
  }

  static getJsonPathValue(obj: any, path: string): any {
    try {
      // Simple JSON path implementation (supports dot notation and array indices)
      const parsed = typeof obj === 'string' ? JSON.parse(obj) : obj;
      const parts = path.split('.');
      let value = parsed;
      for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          value = value[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
        } else {
          value = value[part];
        }
      }
      return value;
    } catch {
      return undefined;
    }
  }

  static runTestScript(script: string, historyItem: RequestHistoryItem): { passed: boolean; error?: string } {
    try {
      // Create a safe execution context
      const func = new Function(
        'response',
        'request',
        'expect',
        `
        const expect = (actual) => ({
          toBe: (expected) => {
            if (actual !== expected) throw new Error(\`Expected \${expected}, got \${actual}\`);
          },
          toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              throw new Error(\`Expected \${JSON.stringify(expected)}, got \${JSON.stringify(actual)}\`);
            }
          },
          toContain: (expected) => {
            if (!String(actual).includes(String(expected))) {
              throw new Error(\`Expected \${actual} to contain \${expected}\`);
            }
          },
          toBeGreaterThan: (expected) => {
            if (Number(actual) <= Number(expected)) {
              throw new Error(\`Expected \${actual} to be greater than \${expected}\`);
            }
          },
          toBeLessThan: (expected) => {
            if (Number(actual) >= Number(expected)) {
              throw new Error(\`Expected \${actual} to be less than \${expected}\`);
            }
          }
        });
        ${script}
      `
      );

      func(
        {
          status: historyItem.response.status,
          headers: historyItem.response.headers,
          body: historyItem.response.body,
          duration: historyItem.response.duration,
        },
        {
          method: historyItem.request.method,
          url: historyItem.request.url,
          headers: historyItem.request.headers,
          body: historyItem.request.body,
        },
        null
      );

      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static createDefaultTest(endpointId: string, name: string = 'Default Test'): Test {
    return {
      id: crypto.randomUUID(),
      name,
      endpointId,
      assertions: [
        {
          id: crypto.randomUUID(),
          type: 'status',
          expected: 200,
          operator: 'equals',
          description: 'Status code should be 200',
        },
      ],
      enabled: true,
    };
  }
}

