/**
 * Editor actions a read-only document still offers: reading it, selecting, moving around and
 * between pages, previewing, copying, and the canvas's own lifecycle, as Figma keeps while a
 * version is viewed. Every other action changes the document and is refused, so an action added
 * later is refused until it is listed here (`packages/core/tests/editor/read-only.test.ts`).
 */
export const READ_ONLY_ACTIONS: ReadonlySet<string> = new Set([
  // Reads
  'acceptingParent',
  'acceptsChildren',
  'canDistributeNodes',
  'canWrapSelectionInSection',
  'collectVariantOptions',
  'findVariantByValues',
  'getChildren',
  'getCollection',
  'getCollectionCount',
  'getCollections',
  'getComponentPropertyAuthoring',
  'getComponentPropertyBindings',
  'getComponentSetPropertyDefs',
  'getComponentSetVariantConflicts',
  'getDefaultVariantForComponentSet',
  'getExposableInstances',
  'getImage',
  'getInstanceComponentPropertyDefinitions',
  'getInstanceComponentPropertyValue',
  'getLayerTree',
  'getLiveNetwork',
  'getNode',
  'getNodeEditState',
  'getPages',
  'getSelectedNode',
  'getSelectedNodes',
  'getShownStatus',
  'getTextSelectionStyle',
  'getVariable',
  'getVariableCount',
  'getVariablesByType',
  'getVariablesForCollection',
  'getVariantOptionAvailability',
  'getVariantOptions',
  'hitTestAtPoint',
  'isInteractiveEditing',
  'isSyncingComponents',
  'isTopLevel',
  'pageSwitchCount',
  'previewRenameSelected',
  // Recording only: what the edit runs is refused or allowed on its own.
  'asHost',
  'constrainMove',
  'recordEdit',
  'recordEditAsync',
  'resolveColorVariable',
  'resolveNumberVariable',
  'screenToCanvas',
  'selectionSpacing',
  'snapshotPage',
  'statusWorkflow',
  'validateComponentSet',

  // Selection and hover
  'clearSelection',
  'enterContainer',
  'enterContainerOf',
  'exitContainers',
  'select',
  'selectAll',
  'selectAtPoint',
  'selectChildren',
  'selectInverse',
  'selectNextSibling',
  'selectParent',
  'selectPreviousSibling',
  'setCodeFocusNode',
  'setHoveredNode',
  'setMarquee',
  'setMeasurementMode',
  'setTool',
  'validateEnteredContainer',

  // Canvas overlays that show without changing anything
  'clearDesignIssues',
  'setAutoLayoutHover',
  'setDesignIssueHighlight',
  'setDesignIssueMarkers',
  'setDropTarget',
  'setGuidePreview',
  'setGuideRedline',
  'setHoveredGuide',
  'setHoveredIssueMarker',
  'setLayoutInsertIndicator',
  'setRenamingLabel',
  'setRotationPreview',
  'setSelectedGuide',
  'setShapeHandleHover',
  'setSnapGuides',
  'setSnapTargets',
  'setMovePolicy',
  'setTransforming',

  // Viewport and pages
  'applyZoom',
  'getViewportSize',
  'setViewportSize',
  'getViewportChrome',
  'setViewportChrome',
  'centerOn',
  'clearPageViewports',
  'commitPageSwitch',
  'focusComponent',
  'goToMainComponent',
  'pan',
  'preparePage',
  'preparePageNodes',
  'loadPageNodes',
  'pageHoldingNode',
  'revealNodes',
  'setZoomAroundPoint',
  'switchPage',
  'switchToNextPage',
  'switchToPreviousPage',
  'zoomTo100',
  'zoomToBounds',
  'zoomToFit',
  'zoomToLevel',
  'zoomToNextFrame',
  'zoomToPreviousFrame',
  'zoomToSelection',

  // Preview
  'leaveCanvasView',
  'resetPlay',
  'startPlay',
  'stopPlay',
  'togglePlay',

  // Copying out
  'copySelectionAsJSX',
  'copySelectionAsSVG',
  'copySelectionAsText',
  'prepareCopy',

  // Ending what was in progress
  'cancelGesture',
  'cancelNodePreviews',
  'exitNodeEditMode',
  'flushNudge',
  'penCancel',
  'pencilCancel',

  // Canvas, layout, and document lifecycle
  'beginInteractiveEdit',
  'dispose',
  'drawPageShaderFrames',
  'hasShaderRasterizer',
  'loadFontsForNodes',
  'onEditorEvent',
  'refreshDocumentSettings',
  'refreshVariables',
  'releaseGraphResources',
  'removeCanvasRenderer',
  'reportPresented',
  'replaceGraph',
  'requestRefresh',
  'requestRender',
  'requestRepaint',
  'runLayoutForNode',
  'setCanvasKit',
  'setNavigationPhase',
  'setHostRestrictions',
  'setReadOnly',
  'setShaderRasterizer',
  'settleShaderFrames',
  'subscribeToGraph',
  'textSelectionChanged'
])

/**
 * Editor actions that reshape a path in vector edit mode, which a host that keeps layers as they
 * are (`layerEdits: 'none'`) still offers, together with undo and redo of what they did. How much
 * of the path they may change is `pathEdits`' to say.
 */
export const PATH_EDIT_ACTIONS: ReadonlySet<string> = new Set([
  'commitNodeEditChanges',
  'enterNodeEditMode',
  'nodeEditAddVertex',
  'nodeEditAlignVertices',
  'nodeEditBendHandle',
  'nodeEditBreakAtVertex',
  'nodeEditConnectEndpoints',
  'nodeEditDeleteSelected',
  'nodeEditPushHistory',
  'nodeEditRemoveVertex',
  'nodeEditSelectVertex',
  'nodeEditSetHandle',
  'nodeEditZeroVertexHandles',
  'redoAction',
  'setNodeEditNetwork',
  'undoAction'
])

/**
 * Editor actions that move layers within their parents, which a host that lets layers only move
 * (`layerEdits: 'move'`) still offers, together with undo and redo of what they did.
 */
export const MOVE_ACTIONS: ReadonlySet<string> = new Set([
  'commitMove',
  'fitEnclosingGroups',
  'nudgeSelected',
  'redoAction',
  'undoAction'
])

/**
 * Editor actions that reorder a frame's children, which a host that lets layers only move still
 * offers to rearrange the same children, as moving a layer along an auto layout flow does.
 */
export const REORDER_ACTIONS: ReadonlySet<string> = new Set(['setChildOrder'])

/**
 * Editor actions that update any field of a layer, which a host that lets layers only move still
 * offers for a layer's position alone: a drag writes its final position through them.
 */
export const POSITION_ACTIONS: ReadonlySet<string> = new Set(['updateNode', 'updateNodeWithUndo'])
