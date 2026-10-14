import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, MiniMap, Handle, Position, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { designs, type DesignView, type DesignNode } from '../design/systemDesign';

function ArchitectureNode({ data }: NodeProps<DesignNode>) {
  return <>{([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const).map(([side, position]) => <span key={side}><Handle id={`in-${side}`} type="target" position={position} style={side === 'top' || side === 'bottom' ? { left: '35%' } : { top: '35%' }} /><Handle id={`out-${side}`} type="source" position={position} style={side === 'top' || side === 'bottom' ? { left: '65%' } : { top: '65%' }} /></span>)}<div className="design-node-kind">{data.kind}{data.proposed ? ' ? Proposed' : ''}</div><div className="design-node-title">{data.label}</div><div className="design-node-fields">{data.fields.slice(0, 4).map(field => <div key={field}>{field}</div>)}</div></>;
}
const nodeTypes = { architecture: ArchitectureNode };
const labels: Record<DesignView, string> = { flow: 'Application flow', database: 'Database map', scale: 'Scale proposal' };
function Canvas({ view }: { view: DesignView }) {
  const diagram = designs[view];
  const flowInstance = useRef<ReactFlowInstance<DesignNode> | null>(null);
  const [zoom, setZoom] = useState(.55);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [journey, setJourney] = useState('complete');
  function changeZoom(factor: number) {
    const flow = flowInstance.current;
    if (flow) void flow.zoomTo(Math.max(.15, Math.min(2.5, flow.getZoom() * factor)), { duration: 80 });
  }
  function fitDiagram() { void flowInstance.current?.fitView({ padding: .1, duration: 180 }); }
  function actualSize() {
    const flow = flowInstance.current;
    if (!flow) return;
    const bounds = flow.getNodesBounds([selected]);
    void flow.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { zoom: 1, duration: 150 });
  }
  const [selectedId, setSelectedId] = useState(diagram.nodes[0].id);
  const [focusConnections, setFocusConnections] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [question, setQuestion] = useState('My order arrived but the bottle is broken. What can I do?');
  const [cacheHit, setCacheHit] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2600);
  const steps = useMemo(() => {
    const signIn = [
      { node: 'ui', edge: '', title: 'Open the workspace', text: 'Restore an existing session or enter the assigned agent credentials. This is a guided simulation.' },
      { node: 'auth', edge: 'ui-auth', title: 'Sign in with Supabase Auth', text: 'Supabase verifies the credentials and returns an access token. Provider API keys stay on the backend.' },
      { node: 'direct', edge: 'ui-direct', title: 'Resolve brand membership', text: 'The browser loads the assigned brand using the agent token. Database RLS restricts visibility; missing membership blocks the workspace.' },
      { node: 'db', edge: 'direct-db', title: 'Load the brand workspace', text: 'Read customer conversations and order information under brand permissions. The agent can switch between Customer and Agent testing views.' },
    ];
    const knowledge = [
      { node: 'ui', edge: '', title: 'Manage brand knowledge', text: 'Open Knowledge Base to create, edit, or delete policies for the assigned brand.' },
      { node: 'direct', edge: 'ui-direct', title: 'Save a policy change', text: 'The browser sends the change with its agent token. Updates and deletes check the expected policy version to detect concurrent edits.' },
      { node: 'db', edge: 'direct-db', title: 'Advance policy revisions', text: 'Content edits increment the entry version; KB mutations advance the brand knowledge revision. Old caches miss and old drafts fail approval. New entries start at version 1.' },
      { node: 'index', edge: 'ui-index', title: 'Index the current policy', text: 'The agent indexes one entry or starts a sequential batch. The backend verifies access; an already-current embedding skips the provider call.' },
      { node: 'embed', edge: 'index-embed', title: 'Embed the policy document', text: 'Gemini generates a 768-dimensional document embedding. A failed request leaves the entry needing indexing and can be retried.' },
      { node: 'db', edge: 'index-db', title: 'Save only the expected version', text: 'An atomic write checks the policy version again. A policy edited or deleted during embedding rejects the write; index changes invalidate cache entries.' },
      { node: 'ui', edge: '', title: 'Verify the updated knowledge', text: 'The workspace shows index status. Test policy retrieval or generate a fresh reply to inspect the evidence from the updated policies.' },
    ];
    const history = [
      { node: 'ui', edge: '', title: 'Open session history', text: 'The agent opens previous conversations for the currently selected customer.' },
      { node: 'direct', edge: 'ui-direct', title: 'Read closed sessions', text: 'Load closed sessions filtered by brand and customer. Before reading messages, verify the selected session belongs to that same customer.' },
      { node: 'db', edge: 'direct-db', title: 'Preserve the original audit', text: 'Closed conversations retain messages and generation evidence. Database permissions continue to restrict brand access.' },
      { node: 'ui', edge: '', title: 'Choose historical context explicitly', text: 'Viewing history does not add it to the AI prompt. Select one previous session for context; changing this selection clears the visible draft.' },
      { node: 'generate', edge: 'ui-generate', title: 'Generate with bounded history', text: 'The backend verifies the previous session and includes at most 20 historical messages and 24,000 content characters alongside recent current messages.' },
      { node: 'db', edge: 'generate-db', title: 'Record the context snapshot', text: 'The generation audit records the selected previous session and its context snapshot. Historical replies are background, not current policy authority.' },
    ];
    const reply = [
    { node: 'ui', edge: '', title: 'Customer sends a question', text: 'The customer message enters the conversation. In this simulation no actual message is saved.' },
    { node: 'direct', edge: 'ui-direct', title: 'Persist the message', text: 'supabase-js sends an authenticated insert to the database API. RLS checks brand membership.' },
    { node: 'db', edge: 'direct-db', title: 'Store customer history', text: 'PostgreSQL stores the message, checks relationships, and serializes conversation writes.' },
    { node: 'generate', edge: 'ui-generate', title: 'Agent clicks Generate', text: 'The backend verifies access, loads order facts and recent messages, and claims a unique generation request.' },
    { node: 'retrieve', edge: 'generate-retrieve', title: 'Build the search context', text: 'The backend builds a query from the last three customer messages across selected history and the current session, truncated to the last 2,000 characters. Retrieval normalizes whitespace before hashing.' },
    { node: 'cache', edge: 'retrieve-cache', title: 'Check the exact-query cache', text: cacheHit ? 'Simulated HIT: brand, query hash, revisions, configuration, and 24-hour expiry match.' : 'Simulated MISS: there is no reusable current cache entry.' },
    ...(cacheHit ? [] : [{ node: 'embed', edge: 'retrieve-embed', title: 'Embed the query', text: 'Gemini produces a 768-dimensional query vector. A provider failure falls back to keyword search.' }]),
    { node: 'db', edge: 'retrieve-db', title: cacheHit ? 'Reload current evidence' : 'Search brand policies', text: cacheHit ? 'Cached IDs are resolved to current policy text under agent permissions. No query embedding call.' : 'Brand-filtered keyword and vector candidates are combined; stale embeddings are excluded. Current results may be cached.' },
    { node: 'llm', edge: 'generate-llm', title: 'Draft with evidence', text: 'When candidates exist, Gemini receives policies, conversation, and order facts and returns a draft with evidence or abstention. With zero candidates, the backend creates a review fallback without calling the reply model.' },
    { node: 'generate', edge: 'llm-generate', title: 'Validate the output', text: 'The backend checks response shape, policy IDs, and exact quotes. These checks do not prove every claim is correct.' },
    { node: 'db', edge: 'generate-db', title: 'Save the audit record', text: 'Store original draft, evidence snapshots, model usage, and timing. Nothing has been sent yet.' },
    { node: 'ui', edge: '', title: 'Agent reviews and edits', text: 'Human review is required. This playback simulates approval; it never approves a real response.' },
    { node: 'ui', edge: '', title: 'Optional alternatives', text: 'This is a choice, not an automatic step: regenerate a draft, or send a manual agent message without AI. This walkthrough continues with approval of the existing draft.' },
    { node: 'approve', edge: 'ui-approve', title: 'Approve in one transaction', text: 'Check brand access and freshness. Reject changed messages or policies. A repeat request returns the existing sent message.' },
    { node: 'db', edge: 'approve-db', title: 'Commit final response', text: 'The final agent message and edited response audit are saved together. This does not issue a refund or replacement.' },
    { node: 'ui', edge: '', title: 'Customer sees the reply', text: 'The initiating workspace appends the saved message immediately. Other open tabs need Refresh; there is no Realtime subscription yet. No real requests or writes occur in playback.' },
    ];
    if (journey === 'signin') return signIn;
    if (journey === 'knowledge') return knowledge;
    if (journey === 'history') return history;
    if (journey === 'reply') return reply;
    return [...signIn, ...knowledge, ...history, ...reply,
      { node: 'auth', edge: 'ui-auth', title: 'Sign out', text: 'End the agent session and return to the sign-in screen. Walkthrough complete; no real requests or writes were performed.' },
    ];
  }, [cacheHit, journey]);
  const activeStep = stepIndex >= 0 ? steps[stepIndex] : null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('button, input, select, .react-flow__minimap')) return;
      const flow = flowInstance.current;
      if (!flow) return;
      event.preventDefault();
      setPlaying(false);
      const viewport = flow.getViewport();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const next = Math.max(.15, Math.min(2.5, viewport.zoom * Math.exp(-Math.max(-120, Math.min(120, delta)) * (event.ctrlKey ? .018 : .006))));
      void flow.setViewport({ x: x - (x - viewport.x) * next / viewport.zoom, y: y - (y - viewport.y) * next / viewport.zoom, zoom: next }, { duration: 0 });
    };
    canvas.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => canvas.removeEventListener('wheel', wheel, true);
  }, []);
  const activeId = activeStep?.node ?? selectedId;
  useEffect(() => {
    if (!activeStep || !flowInstance.current) return;
    const target = diagram.nodes.find(node => node.id === activeStep.node);
    if (!target) return;
    const bounds = flowInstance.current.getNodesBounds([target]);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void flowInstance.current.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { zoom: .95, duration: reduced ? 0 : 220 });
  }, [activeStep, diagram]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (stepIndex >= steps.length - 1) setPlaying(false);
      else setStepIndex(value => value + 1);
    }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, stepIndex, steps.length, speed]);
  const nodes = useMemo(() => diagram.nodes.map(node => ({ ...node, type: 'architecture', selected: node.id === activeId, className: activeStep && node.id === activeId ? 'playback-active-node' : '', style: { ...node.style, opacity: activeStep && node.id !== activeId ? .45 : 1 } })), [diagram, activeId, activeStep]);
  const edges = useMemo(() => diagram.edges.map(edge => {
    const active = activeStep?.edge === edge.id;
    const dim = activeStep ? !active : focusConnections && edge.source !== selectedId && edge.target !== selectedId;
    return { ...edge, animated: active, style: { ...edge.style, strokeWidth: active ? 3 : 1.8, opacity: dim ? .15 : 1 }, labelStyle: { ...edge.labelStyle, opacity: dim ? .15 : 1 } };
  }), [diagram, focusConnections, selectedId, activeStep]);
  const selected = diagram.nodes.find(node => node.id === activeId)!;
  return <>{view === 'flow' && <div className="playback-toolbar"><label>Walkthrough<select value={journey} onChange={event => { setJourney(event.target.value); setPlaying(false); setStepIndex(-1); }}><option value="complete">Complete walkthrough</option><option value="signin">Sign in and brand access</option><option value="reply">Customer and agent replies</option><option value="knowledge">Knowledge management</option><option value="history">Session history</option></select></label><div className="playback-question"><label htmlFor="playback-question">Simulate a customer question</label><input id="playback-question" value={question} maxLength={500} onChange={event => setQuestion(event.target.value)} disabled={playing || stepIndex >= 0} /></div><label className="playback-branch">Cache path<select value={cacheHit ? 'hit' : 'miss'} disabled={stepIndex >= 0} onChange={event => setCacheHit(event.target.value === 'hit')}><option value="miss">Cache miss</option><option value="hit">Cache hit</option></select></label><label className="playback-speed">Pace<select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={3600}>Slow</option><option value={2600}>Normal</option><option value={1600}>Fast</option></select></label><button disabled={!question.trim()} onClick={() => { if (stepIndex < 0 || stepIndex === steps.length - 1) setStepIndex(0); setPlaying(value => !value); }}>{playing ? 'Pause' : stepIndex < 0 || stepIndex === steps.length - 1 ? 'Play flow' : 'Resume'}</button>{stepIndex >= 0 && <button className="secondary compact" onClick={() => { setPlaying(false); setStepIndex(-1); fitDiagram(); }}>Reset</button>}</div>}
  <div className={`design-layout ${activeStep ? 'with-playback' : showDetails ? 'with-details' : 'canvas-only'}`}><div ref={canvasRef} className="design-canvas" aria-label={`${labels[view]} interactive diagram`}><ReactFlow<DesignNode>
    nodes={nodes}
    edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: .08, minZoom: .15, maxZoom: 1 }}
    panOnScroll={false} zoomOnScroll={false} zoomOnPinch panOnDrag zoomOnDoubleClick={false} preventScrolling
    onInit={instance => { flowInstance.current = instance; setZoom(instance.getZoom()); }}
    onMove={(_event, viewport) => setZoom(viewport.zoom)}
    minZoom={.15} maxZoom={2.5} nodesDraggable={false} nodesConnectable={false}
    edgesReconnectable={false} deleteKeyCode={null} onNodeClick={(_event, node) => { setPlaying(false); setStepIndex(-1); setSelectedId(node.id); setShowDetails(true); }}
  ><Background color="#b6c8ed" gap={22} /><MiniMap nodeColor="#dbe7ff" maskColor="rgba(37,99,235,.09)" pannable zoomable /></ReactFlow>
  <div className="canvas-zoom-controls" aria-label="Canvas zoom controls"><button className="secondary compact" aria-label="Zoom out" disabled={zoom <= .151} onClick={() => changeZoom(1 / 1.35)}>&minus;</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button className="secondary compact" aria-label="Zoom in" disabled={zoom >= 2.499} onClick={() => changeZoom(1.35)}>+</button><button className="secondary compact" onClick={fitDiagram}>Fit all</button><button className="secondary compact" onClick={actualSize}>100%</button></div><button className="secondary compact canvas-details-toggle" onClick={() => setShowDetails(value => !value)}>{showDetails ? 'Hide details' : 'Show details'}</button></div>
  {activeStep && <div className="playback-caption" role="status"><div className="playback-caption-meta"><span>GUIDED SIMULATION ? {stepIndex + 1} / {steps.length}</span><span>{playing ? 'Playing' : stepIndex === steps.length - 1 ? 'Complete' : 'Paused'}</span></div><h3>{activeStep.title}</h3><p>{activeStep.text}</p><blockquote>{question}</blockquote><progress max={steps.length} value={stepIndex + 1} aria-label="Playback progress" /><div className="playback-step-buttons"><button className="secondary compact" disabled={stepIndex === 0} onClick={() => { setPlaying(false); setStepIndex(value => value - 1); }}>Previous</button><button className="secondary compact" disabled={stepIndex === steps.length - 1} onClick={() => { setPlaying(false); setStepIndex(value => value + 1); }}>Next</button></div></div>}
  {(activeStep || showDetails) && <aside className="panel design-inspector" aria-live="polite"><span className="eyebrow">{selected.data.proposed ? 'PROPOSED AT SCALE' : 'CURRENT IMPLEMENTATION'}</span><h2>{selected.data.label}</h2>{activeStep && <p className="muted small">Component details for this walkthrough step</p>}<p className="muted">{selected.data.description}</p><h3>{view === 'database' ? 'Key fields' : 'Responsibilities'}</h3><ul>{selected.data.fields.map(field => <li key={field}>{field}</li>)}</ul>{!activeStep && <button className="secondary compact" aria-pressed={focusConnections} onClick={() => setFocusConnections(value => !value)}>{focusConnections ? 'Show all connections' : 'Focus node connections'}</button>}<h3>Safeguards & boundaries</h3><ul>{selected.data.safeguards.map(rule => <li key={rule}>{rule}</li>)}</ul>{!activeStep && <><label htmlFor="design-node-select">Explore a component</label><select id="design-node-select" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{diagram.nodes.map(node => <option key={node.id} value={node.id}>{node.data.label}</option>)}</select></>}</aside>}</div></>;
}
export default function SystemDesignWorkspace() {
  const [view, setView] = useState<DesignView>('flow');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', escape); };
  }, [expanded]);
  return <section className={`design-workspace ${expanded ? 'design-expanded' : ''}`}><div className="design-compact-heading"><div><span className="eyebrow">ARCHITECTURE EXPLORER</span><h1>System design</h1></div><button className="secondary compact" onClick={() => setExpanded(value => !value)}>{expanded ? 'Exit fullscreen' : 'Fullscreen'}</button></div><div className="design-toolbar"><div className="mode-switch" aria-label="Diagram view">{(Object.keys(labels) as DesignView[]).map(key => <button key={key} className={view === key ? 'selected' : ''} aria-pressed={view === key} onClick={() => setView(key)}>{labels[key]}</button>)}</div><p className="muted small">Drag to pan ? Scroll or pinch to zoom ? Fit all resets the view</p></div>{view === 'scale' && <p className="design-scope-note">Proposed design for 500 brands, 5,000 agents and millions of messages. Excalidraw-style layout; dashed blocks are future infrastructure. Services are logical boundaries, not a requirement for separate deployments.</p>}{view === 'database' && <p className="design-scope-note">Documented table relationships and key columns, not live database data.</p>}<Canvas key={view} view={view} /></section>;
}
