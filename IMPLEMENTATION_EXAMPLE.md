# Implementation Example: Collections & Workspaces

This document shows how to implement the **Collections & Workspaces** feature as a concrete example of expanding the app.

## Overview

Add the ability to organize endpoints into collections and manage multiple workspaces.

## Step 1: Update Types

```typescript
// types.ts - Add these interfaces

export interface Collection {
  id: string;
  name: string;
  description?: string;
  endpointIds: string[]; // References to endpoint IDs
  folders: Folder[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  color?: string; // For UI organization
}

export interface Folder {
  id: string;
  name: string;
  endpointIds: string[];
  parentId?: string; // For nested folders
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  collectionIds: string[];
  environmentIds: string[];
  activeEnvironmentId: string | null;
  createdAt: number;
  updatedAt: number;
}

// Extend ApiEndpoint to include collection reference
export interface ApiEndpoint {
  // ... existing fields
  collectionId?: string;
  folderId?: string;
  workspaceId?: string;
}
```

## Step 2: Create Collection Service

```typescript
// services/CollectionService.ts

import type { Collection, Folder, Workspace, ApiEndpoint } from '../types';

export class CollectionService {
  private static STORAGE_KEY_COLLECTIONS = 'api-extractor-collections';
  private static STORAGE_KEY_WORKSPACES = 'api-extractor-workspaces';
  private static STORAGE_KEY_ACTIVE_WORKSPACE = 'api-extractor-active-workspace';

  // Collections
  static getCollections(): Collection[] {
    const data = localStorage.getItem(this.STORAGE_KEY_COLLECTIONS);
    return data ? JSON.parse(data) : [];
  }

  static saveCollection(collection: Collection): void {
    const collections = this.getCollections();
    const index = collections.findIndex(c => c.id === collection.id);
    if (index >= 0) {
      collections[index] = { ...collection, updatedAt: Date.now() };
    } else {
      collections.push({ ...collection, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(this.STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  }

  static deleteCollection(id: string): void {
    const collections = this.getCollections().filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  }

  static addEndpointToCollection(collectionId: string, endpointId: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection && !collection.endpointIds.includes(endpointId)) {
      collection.endpointIds.push(endpointId);
      this.saveCollection(collection);
    }
  }

  static removeEndpointFromCollection(collectionId: string, endpointId: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection) {
      collection.endpointIds = collection.endpointIds.filter(id => id !== endpointId);
      this.saveCollection(collection);
    }
  }

  // Workspaces
  static getWorkspaces(): Workspace[] {
    const data = localStorage.getItem(this.STORAGE_KEY_WORKSPACES);
    return data ? JSON.parse(data) : [];
  }

  static getActiveWorkspace(): Workspace | null {
    const activeId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    if (!activeId) return null;
    return this.getWorkspaces().find(w => w.id === activeId) || null;
  }

  static setActiveWorkspace(workspaceId: string | null): void {
    if (workspaceId) {
      localStorage.setItem(this.STORAGE_KEY_ACTIVE_WORKSPACE, workspaceId);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    }
  }

  static saveWorkspace(workspace: Workspace): void {
    const workspaces = this.getWorkspaces();
    const index = workspaces.findIndex(w => w.id === workspace.id);
    if (index >= 0) {
      workspaces[index] = { ...workspace, updatedAt: Date.now() };
    } else {
      workspaces.push({ ...workspace, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(this.STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
  }

  static deleteWorkspace(id: string): void {
    const workspaces = this.getWorkspaces().filter(w => w.id !== id);
    localStorage.setItem(this.STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
    // If deleted workspace was active, clear active
    const activeId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    if (activeId === id) {
      localStorage.removeItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    }
  }
}
```

## Step 3: Create Collection Manager Component

```typescript
// components/CollectionManager.tsx

import React, { useState } from 'react';
import { CollectionService } from '../services/CollectionService';
import type { Collection, Workspace } from '../types';
import { PlusIcon, TrashIcon, FolderIcon } from './icons';

interface CollectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  endpoints: ApiEndpoint[];
  onCollectionSelect?: (collectionId: string | null) => void;
}

export const CollectionManager: React.FC<CollectionManagerProps> = ({
  isOpen,
  onClose,
  endpoints,
  onCollectionSelect,
}) => {
  const [collections, setCollections] = useState<Collection[]>(CollectionService.getCollections());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(CollectionService.getWorkspaces());
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    CollectionService.getActiveWorkspace()
  );
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const handleCreateCollection = () => {
    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name: 'New Collection',
      endpointIds: [],
      folders: [],
      tags: [],
    };
    CollectionService.saveCollection(newCollection);
    setCollections(CollectionService.getCollections());
    setSelectedCollection(newCollection.id);
  };

  const handleCreateWorkspace = () => {
    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      name: 'New Workspace',
      collectionIds: [],
      environmentIds: [],
      activeEnvironmentId: null,
    };
    CollectionService.saveWorkspace(newWorkspace);
    setWorkspaces(CollectionService.getWorkspaces());
    setActiveWorkspace(newWorkspace);
    CollectionService.setActiveWorkspace(newWorkspace.id);
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

  if (!isOpen) return null;

  const currentCollections = activeWorkspace
    ? collections.filter(c => activeWorkspace.collectionIds.includes(c.id))
    : collections;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-brand-surface border border-brand-primary rounded-lg shadow-xl w-[900px] h-[700px] flex flex-col">
        <div className="p-4 border-b border-brand-primary flex justify-between items-center">
          <h2 className="text-xl font-semibold text-brand-text">Collections & Workspaces</h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">
            Close
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Workspaces Sidebar */}
          <div className="w-1/4 border-r border-brand-primary p-4 bg-brand-bg/50">
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
            <div className="space-y-1 overflow-y-auto">
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

            <div className="space-y-2">
              {currentCollections.map(collection => {
                const collectionEndpoints = endpoints.filter(e =>
                  collection.endpointIds.includes(e.path + e.method)
                );
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
                          {collectionEndpoints.length} endpoint(s)
                        </p>
                      </div>
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
                );
              })}
              {currentCollections.length === 0 && (
                <div className="text-center text-brand-subtle py-8">
                  <p>No collections yet. Create one to organize your endpoints.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Step 4: Update App.tsx

```typescript
// App.tsx - Add these state variables and handlers

const [collections, setCollections] = useState<Collection[]>([]);
const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
const [isCollectionManagerOpen, setIsCollectionManagerOpen] = useState(false);

// Filter endpoints by selected collection
const displayedEndpoints = selectedCollectionId
  ? extractedEndpoints.filter(ep => {
      const collection = collections.find(c => c.id === selectedCollectionId);
      return collection?.endpointIds.includes(`${ep.path}-${ep.method}`);
    })
  : extractedEndpoints;

// After extraction, optionally add to collection
const handleAddToCollection = (endpoint: ApiEndpoint, collectionId: string) => {
  CollectionService.addEndpointToCollection(collectionId, `${endpoint.path}-${endpoint.method}`);
  setCollections(CollectionService.getCollections());
};

// In the render, replace extractedEndpoints with displayedEndpoints
<ResultsDisplay
  endpoints={displayedEndpoints}
  // ... other props
/>
```

## Step 5: Add Collection Selector to UI

```typescript
// components/CollectionSelector.tsx

import React from 'react';
import { CollectionService } from '../services/CollectionService';
import type { Collection } from '../types';

interface CollectionSelectorProps {
  selectedCollectionId: string | null;
  onSelect: (id: string | null) => void;
}

export const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  selectedCollectionId,
  onSelect,
}) => {
  const collections = CollectionService.getCollections();

  return (
    <select
      value={selectedCollectionId || ''}
      onChange={(e) => onSelect(e.target.value || null)}
      className="bg-brand-surface border border-brand-primary rounded px-3 py-1 text-sm text-brand-text"
    >
      <option value="">All Endpoints</option>
      {collections.map(c => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
};
```

## Step 6: Add Drag-and-Drop (Optional)

```typescript
// Install: npm install react-beautiful-dnd @types/react-beautiful-dnd

// components/DraggableEndpointList.tsx

import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Use in ResultsDisplay to allow reordering and moving between collections
```

## Testing Checklist

- [ ] Create new collection
- [ ] Delete collection
- [ ] Add endpoint to collection
- [ ] Remove endpoint from collection
- [ ] Filter endpoints by collection
- [ ] Create new workspace
- [ ] Switch between workspaces
- [ ] Persist collections/workspaces in localStorage
- [ ] Handle edge cases (empty collections, deleted endpoints)

## Next Steps

1. Implement the basic structure above
2. Add UI polish (animations, better styling)
3. Add drag-and-drop for organizing
4. Add collection import/export
5. Add collection sharing (if team features are added)

This example shows the pattern for implementing other features:
1. Define types
2. Create service layer
3. Build UI components
4. Integrate into main app
5. Add polish and edge cases

