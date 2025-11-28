import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from './icons';

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

interface EnvironmentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  setEnvironments: (envs: Environment[]) => void;
  activeEnvId: string | null;
  setActiveEnvId: (id: string | null) => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({
  isOpen,
  onClose,
  environments,
  setEnvironments,
  activeEnvId,
  setActiveEnvId,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvId);

  useEffect(() => {
    if (isOpen && activeEnvId) {
        setSelectedEnvId(activeEnvId);
    }
  }, [isOpen, activeEnvId]);

  if (!isOpen) return null;

  const handleAddEnv = () => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name: 'New Environment',
      variables: {},
    };
    setEnvironments([...environments, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const handleDeleteEnv = (id: string) => {
    setEnvironments(environments.filter((e) => e.id !== id));
    if (selectedEnvId === id) setSelectedEnvId(null);
    if (activeEnvId === id) setActiveEnvId(null);
  };

  const handleUpdateEnvName = (id: string, name: string) => {
    setEnvironments(
      environments.map((e) => (e.id === id ? { ...e, name } : e))
    );
  };

  const handleAddVariable = (envId: string) => {
    setEnvironments(
      environments.map((e) => {
        if (e.id === envId) {
          return { ...e, variables: { ...e.variables, '': '' } };
        }
        return e;
      })
    );
  };

  const handleUpdateVariable = (envId: string, oldKey: string, newKey: string, newValue: string) => {
    setEnvironments(
      environments.map((e) => {
        if (e.id === envId) {
          const newVariables = { ...e.variables };
          if (oldKey !== newKey) {
            delete newVariables[oldKey];
          }
          newVariables[newKey] = newValue;
          return { ...e, variables: newVariables };
        }
        return e;
      })
    );
  };

  const handleDeleteVariable = (envId: string, key: string) => {
    setEnvironments(
      environments.map((e) => {
        if (e.id === envId) {
          const newVariables = { ...e.variables };
          delete newVariables[key];
          return { ...e, variables: newVariables };
        }
        return e;
      })
    );
  };

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary/30 rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        <div className="p-4 border-b border-brand-primary/20 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-brand-text">Environment Manager</h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text" title="Close" aria-label="Close">
            Close
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-brand-primary/20 p-4 flex flex-col gap-2 bg-brand-bg/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-brand-subtle">Environments</span>
              <button onClick={handleAddEnv} className="text-brand-primary hover:text-brand-primary/80" title="Add Environment" aria-label="Add Environment">
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center group ${
                    selectedEnvId === env.id ? 'bg-brand-primary/20 text-brand-text' : 'text-brand-subtle hover:bg-brand-surface'
                  }`}
                  onClick={() => setSelectedEnvId(env.id)}
                >
                  <span className="truncate">{env.name}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     {activeEnvId === env.id ? (
                        <span className="text-xs text-green-400 font-bold px-1">Active</span>
                     ) : (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActiveEnvId(env.id); }}
                            className="text-xs text-brand-subtle hover:text-brand-primary"
                            title="Set as Active"
                        >
                            Set Active
                        </button>
                     )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnv(env.id);
                      }}
                      className="text-brand-subtle hover:text-red-400"
                      title="Delete Environment"
                      aria-label="Delete Environment"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedEnv ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-brand-subtle mb-1">Environment Name</label>
                  <input
                    type="text"
                    value={selectedEnv.name}
                    onChange={(e) => handleUpdateEnvName(selectedEnv.id, e.target.value)}
                    className="w-full bg-brand-bg border border-brand-primary/30 rounded px-3 py-2 text-brand-text focus:outline-none focus:border-brand-primary"
                    aria-label="Environment Name"
                    placeholder="Environment Name"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm text-brand-subtle">Variables</label>
                    <button
                      onClick={() => handleAddVariable(selectedEnv.id)}
                      className="text-xs text-brand-primary hover:text-brand-primary/80 flex items-center gap-1"
                      title="Add Variable"
                      aria-label="Add Variable"
                    >
                      <PlusIcon className="w-4 h-4" /> Add Variable
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {Object.entries(selectedEnv.variables).map(([key, value], index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Key"
                          value={key}
                          onChange={(e) => handleUpdateVariable(selectedEnv.id, key, e.target.value, value as string)}
                          className="flex-1 bg-brand-bg border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                          aria-label="Variable Key"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={value as string}
                          onChange={(e) => handleUpdateVariable(selectedEnv.id, key, key, e.target.value)}
                          className="flex-1 bg-brand-bg border border-brand-primary/30 rounded px-2 py-1 text-sm text-brand-text"
                          aria-label="Variable Value"
                        />
                        <button
                          onClick={() => handleDeleteVariable(selectedEnv.id, key)}
                          className="text-brand-subtle hover:text-red-400 px-1"
                          title="Delete Variable"
                          aria-label="Delete Variable"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                    {Object.keys(selectedEnv.variables).length === 0 && (
                        <div className="text-sm text-brand-subtle/50 italic text-center py-4">No variables defined</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-brand-subtle">
                Select an environment to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
