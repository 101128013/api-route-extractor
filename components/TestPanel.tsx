import React, { useState, useEffect } from 'react';
import { TestService } from '../services/TestService';
import type { Test, Assertion, RequestHistoryItem, TestResult } from '../types';
import { TestIcon, PlusIcon, TrashIcon, PlayIcon, XIcon, CheckIcon, XCircleIcon } from './icons';

interface TestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  endpointId: string;
  endpointPath: string;
  onRunTests?: (historyItem: RequestHistoryItem) => Promise<void>;
}

export const TestPanel: React.FC<TestPanelProps> = ({
  isOpen,
  onClose,
  endpointId,
  endpointPath,
  onRunTests,
}) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    if (isOpen && endpointId) {
      const endpointTests = TestService.getTestsForEndpoint(endpointId);
      setTests(endpointTests);
    }
  }, [isOpen, endpointId]);

  const handleCreateTest = () => {
    const newTest = TestService.createDefaultTest(endpointId, `Test for ${endpointPath}`);
    setEditingTest(newTest);
  };

  const handleSaveTest = (test: Test) => {
    TestService.saveTest(test);
    setTests(TestService.getTestsForEndpoint(endpointId));
    setEditingTest(null);
  };

  const handleDeleteTest = (id: string) => {
    if (confirm('Delete this test?')) {
      TestService.deleteTest(id);
      setTests(TestService.getTestsForEndpoint(endpointId));
      if (selectedTest?.id === id) {
        setSelectedTest(null);
      }
    }
  };

  const handleRunTest = async (test: Test, historyItem: RequestHistoryItem) => {
    const result = await TestService.runTest(test, historyItem);
    setTestResults(prev => ({ ...prev, [test.id]: result }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-[900px] h-[700px] flex flex-col">
        <div className="p-4 border-b border-brand-primary flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TestIcon />
            <h2 className="text-xl font-semibold text-brand-text">Tests for {endpointPath}</h2>
          </div>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">
            <XIcon />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 border-r border-brand-primary p-4 bg-brand-bg/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-brand-subtle">Tests</span>
              <button
                onClick={handleCreateTest}
                className="text-brand-primary hover:text-brand-primary/80"
                title="New Test"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto">
              {tests.map(test => {
                const result = testResults[test.id];
                return (
                  <div
                    key={test.id}
                    className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                      selectedTest?.id === test.id
                        ? 'bg-brand-primary/20 text-brand-text'
                        : 'text-brand-subtle hover:bg-brand-surface'
                    }`}
                    onClick={() => setSelectedTest(test)}
                  >
                    <div className="flex items-center gap-2">
                      {result ? (
                        result.passed ? (
                          <CheckIcon />
                        ) : (
                          <XCircleIcon className="w-4 h-4 text-red-400" />
                        )
                      ) : (
                        <TestIcon className="w-4 h-4" />
                      )}
                      <span className="truncate">{test.name}</span>
                    </div>
                    {!test.enabled && (
                      <span className="text-xs text-brand-subtle">Disabled</span>
                    )}
                  </div>
                );
              })}
              {tests.length === 0 && (
                <p className="text-sm text-brand-subtle/50 italic">No tests defined</p>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {editingTest ? (
              <EditTest
                test={editingTest}
                onSave={handleSaveTest}
                onCancel={() => setEditingTest(null)}
              />
            ) : selectedTest ? (
              <ViewTest
                test={selectedTest}
                result={testResults[selectedTest.id]}
                onEdit={() => setEditingTest(selectedTest)}
                onDelete={() => handleDeleteTest(selectedTest.id)}
                onRun={onRunTests ? (historyItem) => handleRunTest(selectedTest, historyItem) : undefined}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-brand-subtle">
                Select or create a test
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EditTest: React.FC<{
  test: Test;
  onSave: (test: Test) => void;
  onCancel: () => void;
}> = ({ test, onSave, onCancel }) => {
  const [name, setName] = useState(test.name);
  const [enabled, setEnabled] = useState(test.enabled);
  const [assertions, setAssertions] = useState<Assertion[]>(test.assertions);

  const handleAddAssertion = () => {
    setAssertions([
      ...assertions,
      {
        id: crypto.randomUUID(),
        type: 'status',
        expected: 200,
        operator: 'equals',
        description: '',
      },
    ]);
  };

  const handleUpdateAssertion = (id: string, updates: Partial<Assertion>) => {
    setAssertions(assertions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleDeleteAssertion = (id: string) => {
    setAssertions(assertions.filter(a => a.id !== id));
  };

  const handleSave = () => {
    onSave({ ...test, name, enabled, assertions });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-brand-text">Edit Test</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-brand-subtle mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            id="enabled"
          />
          <label htmlFor="enabled" className="text-sm text-brand-subtle">Enabled</label>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm text-brand-subtle">Assertions</label>
            <button
              onClick={handleAddAssertion}
              className="text-xs text-brand-secondary hover:text-brand-secondary/80 flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {assertions.map(assertion => (
              <div key={assertion.id} className="p-3 bg-brand-bg rounded border border-brand-primary">
                <div className="flex justify-between items-start mb-2">
                  <select
                    value={assertion.type}
                    onChange={(e) => handleUpdateAssertion(assertion.id, { type: e.target.value as any })}
                    className="bg-brand-surface border border-brand-primary rounded px-2 py-1 text-sm text-brand-text"
                  >
                    <option value="status">Status Code</option>
                    <option value="header">Header</option>
                    <option value="body">Body</option>
                    <option value="responseTime">Response Time</option>
                  </select>
                  <button
                    onClick={() => handleDeleteAssertion(assertion.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {assertion.type === 'header' && (
                    <input
                      type="text"
                      placeholder="Header name"
                      value={assertion.property || ''}
                      onChange={(e) => handleUpdateAssertion(assertion.id, { property: e.target.value })}
                      className="w-full bg-brand-surface border border-brand-primary rounded px-2 py-1 text-sm text-brand-text"
                    />
                  )}
                  {assertion.type === 'body' && (
                    <input
                      type="text"
                      placeholder="JSON path (e.g., data.id)"
                      value={assertion.path || ''}
                      onChange={(e) => handleUpdateAssertion(assertion.id, { path: e.target.value })}
                      className="w-full bg-brand-surface border border-brand-primary rounded px-2 py-1 text-sm text-brand-text"
                    />
                  )}
                  <select
                    value={assertion.operator || 'equals'}
                    onChange={(e) => handleUpdateAssertion(assertion.id, { operator: e.target.value as any })}
                    className="bg-brand-surface border border-brand-primary rounded px-2 py-1 text-sm text-brand-text"
                  >
                    <option value="equals">Equals</option>
                    <option value="notEquals">Not Equals</option>
                    <option value="contains">Contains</option>
                    <option value="matches">Matches (Regex)</option>
                    <option value="greaterThan">Greater Than</option>
                    <option value="lessThan">Less Than</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Expected value"
                    value={typeof assertion.expected === 'string' ? assertion.expected : JSON.stringify(assertion.expected)}
                    onChange={(e) => {
                      let value: any = e.target.value;
                      try {
                        value = JSON.parse(value);
                      } catch {
                        // Keep as string
                      }
                      handleUpdateAssertion(assertion.id, { expected: value });
                    }}
                    className="w-full bg-brand-surface border border-brand-primary rounded px-2 py-1 text-sm text-brand-text"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-brand-subtle hover:text-brand-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-brand-secondary text-white rounded hover:bg-brand-secondary/80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const ViewTest: React.FC<{
  test: Test;
  result?: TestResult;
  onEdit: () => void;
  onDelete: () => void;
  onRun?: (historyItem: RequestHistoryItem) => Promise<void>;
}> = ({ test, result, onEdit, onDelete, onRun }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-brand-text">{test.name}</h3>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 text-sm bg-brand-primary text-white rounded hover:bg-brand-primary/80"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-brand-subtle">Enabled: </span>
          <span className={test.enabled ? 'text-green-400' : 'text-red-400'}>
            {test.enabled ? 'Yes' : 'No'}
          </span>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-brand-text mb-2">Assertions</h4>
          <div className="space-y-2">
            {test.assertions.map(assertion => (
              <div key={assertion.id} className="p-2 bg-brand-bg rounded text-sm">
                <div className="text-brand-text">
                  {assertion.type} {assertion.operator} {JSON.stringify(assertion.expected)}
                </div>
                {assertion.description && (
                  <div className="text-brand-subtle text-xs mt-1">{assertion.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {result && (
          <div>
            <h4 className="text-sm font-semibold text-brand-text mb-2">Last Result</h4>
            <div className={`p-3 rounded ${result.passed ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.passed ? (
                  <CheckIcon />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-400" />
                )}
                <span className={result.passed ? 'text-green-400' : 'text-red-400'}>
                  {result.passed ? 'Passed' : 'Failed'}
                </span>
                <span className="text-xs text-brand-subtle">
                  ({result.duration}ms)
                </span>
              </div>
              {result.assertions.map((assertion, idx) => (
                <div key={idx} className="text-xs mt-1">
                  {assertion.passed ? '✓' : '✗'} {assertion.expected} vs {JSON.stringify(assertion.actual)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

