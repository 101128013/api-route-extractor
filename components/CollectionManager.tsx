import React, { useState, useEffect } from 'react';
import { CollectionService } from '../services/CollectionService';
import type { Collection, Workspace, ApiEndpoint } from '../types';
import { PlusIcon, TrashIcon, FolderIcon, CollectionIcon, XIcon, PencilIcon } from './icons';

interface CollectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  endpoints: ApiEndpoint[];
  onCollectionSelect?: (collectionId: string | null) => void;
  selectedCollectionId?: string | null;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  isOpen,
  onClose,
  endpoints,
  onCollectionSelect,
  selectedCollectionId,
}) => {
  const [collections, setCollections] = useState<Collection[]>(CollectionService.getCollections());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(CollectionService.getWorkspaces());
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    CollectionService.getActiveWorkspace()
  );
  const [selectedCollection, setSelectedCollection] = useState<string | null>(selectedCollectionId || null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCollections(CollectionService.getCollections());
      setWorkspaces(CollectionService.getWorkspaces());
      setActiveWorkspace(CollectionService.getActiveWorkspace());
    }
  }, [isOpen]);

  const handleCreateCollection = () => {
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name: 'New Collection',
      endpointIds: [],
      folders: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    CollectionService.saveCollection(newCollection);
    setCollections(CollectionService.getCollections());
    setSelectedCollection(newCollection.id);
    setEditingCollection(newCollection);
  };

  const handleCreateWorkspace = () => {
    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      name: 'New Workspace',
      collectionIds: [],
      environmentIds: [],
      activeEnvironmentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    CollectionService.saveWorkspace(newWorkspace);
    setWorkspaces(CollectionService.getWorkspaces());
    setActiveWorkspace(newWorkspace);
    CollectionService.setActiveWorkspace(newWorkspace.id);
    setEditingWorkspace(newWorkspace);
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Delete this collection? Endpoints will not be deleted.')) {
      CollectionService.deleteCollection(id);
      setCollections(CollectionService.getCollections());
      if (selectedCollection === id) {
        setSelectedCollection(null);
        onCollectionSelect?.(null);
      }
    }
  };

  const handleSelectCollection = (id: string) => {
    setSelectedCollection(id);
    onCollectionSelect?.(id);
  };

  const handleSetActiveWorkspace = (id: string) => {
    CollectionService.setActiveWorkspace(id);
    setActiveWorkspace(CollectionService.getActiveWorkspace());
  };

  const handleSaveCollection = (collection: Collection) => {
    CollectionService.saveCollection(collection);
    setCollections(CollectionService.getCollections());
    setEditingCollection(null);
  };

  const handleSaveWorkspace = (workspace: Workspace) => {
    CollectionService.saveWorkspace(workspace);
    setWorkspaces(CollectionService.getWorkspaces());
    setActiveWorkspace(workspace);
    setEditingWorkspace(null);
  };

  const handleAddEndpointToCollection = (collectionId: string, endpointId: string) => {
    CollectionService.addEndpointToCollection(collectionId, endpointId);
    setCollections(CollectionService.getCollections());
  };

  if (!isOpen) return null;

  const currentCollections = activeWorkspace
    ? collections.filter(c => activeWorkspace.collectionIds.includes(c.id))
    : collections;

  const selectedCollectionData = collections.find(c => c.id === selectedCollection);
  const collectionEndpoints = selectedCollectionData
    ? endpoints.filter(e => {
        const endpointId = e.id || `${e.path}-${e.method}`;
        return selectedCollectionData.endpointIds.includes(endpointId);
      })
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-[1000px] h-[700px] flex flex-col">
        <div className="p-4 border-b border-brand-primary flex justify-between items-center">
          <h2 className="text-xl font-semibold text-brand-text flex items-center gap-2">
            <CollectionIcon />
            Collections & Workspaces
          </h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">
            <XIcon />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Workspaces Sidebar */}
          <div className="w-1/4 border-r border-brand-primary p-4 bg-brand-bg/50 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-brand-subtle">Workspaces</span>
              <button
                onClick={handleCreateWorkspace}
                className="text-brand-primary hover:text-brand-primary/80"
                title="New Workspace"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto flex-1">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-brand-primary/20 text-brand-text'
                      : 'text-brand-subtle hover:bg-brand-surface'
                  }`}
                  onClick={() => handleSetActiveWorkspace(ws.id)}
                >
                  <span className="truncate">{ws.name}</span>
                  {activeWorkspace?.id === ws.id && (
                    <span className="text-xs text-green-400">Active</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Collections Panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-brand-text">Collections</h3>
              <button
                onClick={handleCreateCollection}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-secondary text-white rounded-md hover:bg-brand-secondary/80"
              >
                <PlusIcon /> New Collection
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {currentCollections.map(collection => {
                const collectionEndpointsCount = endpoints.filter(e => {
                  const endpointId = e.id || `${e.path}-${e.method}`;
                  return collection.endpointIds.includes(endpointId);
                }).length;
                return (
                  <div
                    key={collection.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCollection === collection.id
                        ? 'border-brand-secondary bg-brand-secondary/10'
                        : 'border-brand-primary hover:border-brand-primary/50'
                    }`}
                    onClick={() => handleSelectCollection(collection.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-brand-text">{collection.name}</h4>
                        {collection.description && (
                          <p className="text-sm text-brand-subtle mt-1">{collection.description}</p>
                        )}
                        <p className="text-xs text-brand-subtle mt-2">
                          {collectionEndpointsCount} endpoint(s)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollection(collection);
                          }}
                          className="text-brand-subtle hover:text-brand-text"
                          title="Edit Collection"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(collection.id);
                          }}
                          className="text-brand-subtle hover:text-red-400"
                          title="Delete Collection"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentCollections.length === 0 && (
                <div className="text-center text-brand-subtle py-8">
                  <p>No collections yet. Create one to organize your endpoints.</p>
                </div>
              )}
            </div>

            {/* Selected Collection Details */}
            {selectedCollectionData && (
              <div className="border-t border-brand-primary pt-4">
                <h4 className="font-semibold text-brand-text mb-2">
                  Endpoints in {selectedCollectionData.name}
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {collectionEndpoints.map((endpoint, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-brand-bg rounded text-sm text-brand-subtle flex justify-between items-center"
                    >
                      <span className="font-mono">
                        {endpoint.method} {endpoint.path}
                      </span>
                      <button
                        onClick={() => {
                          const endpointId = endpoint.id || `${endpoint.path}-${endpoint.method}`;
                          CollectionService.removeEndpointFromCollection(selectedCollection, endpointId);
                          setCollections(CollectionService.getCollections());
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {collectionEndpoints.length === 0 && (
                    <p className="text-sm text-brand-subtle/50 italic">No endpoints in this collection</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Collection Modal
const EditCollectionModal: React.FC<{
  collection: Collection;
  onSave: (collection: Collection) => void;
  onClose: () => void;
}> = ({ collection, onSave, onClose }) => {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-brand-surface border border-brand-primary rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold text-brand-text mb-4">Edit Collection</h3>
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
          <div>
            <label className="block text-sm text-brand-subtle mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-brand-bg border border-brand-primary rounded px-3 py-2 text-brand-text"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-brand-subtle hover:text-brand-text"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...collection, name, description })}
              className="px-4 py-2 text-sm bg-brand-secondary text-white rounded hover:bg-brand-secondary/80"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

