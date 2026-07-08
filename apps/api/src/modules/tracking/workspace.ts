// Workspace resolution is shared infrastructure (used by tracking and sync), so
// it lives in core/ to keep the modules from importing each other's internals
// (the boundary rule). Re-exported here for the tracking module's call sites.
export { resolveWorkspaceId } from '../../core/workspace.js'
