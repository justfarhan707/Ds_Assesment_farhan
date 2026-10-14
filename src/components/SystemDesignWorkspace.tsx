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
  function changeZoom(factor: number) {
    const flow = flowInstance.current;
    if (flow) void flow.zoomTo(Math.max(.15, Math.min(2.5, flow.getZoom() * factor)), { duration: 220 });
  }
  function fitDiagram() { void flowInstance.current?.fitView({ padding: .1, duration: 350 }); }
  function actualSize() {
    const flow = flowInstance.current;
    if (!flow) return;
    const bounds = flow.getNodesBounds([selected]);
    void flow.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { zoom: 1, duration: 300 });
  }
  const [selectedId, setSelectedId] = useState(diagram.nodes[0].id);
  const [focusConnections, setFocusConnections] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [question, setQuestion] = useState('My order arrived but the bottle is broken. What can I do?');
  const [cacheHit, setCacheHit] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2600);
  const steps = useMemo(() => [
    { node: 'ui', edge: '', title: 'Customer sends a question', text: 'The customer message enters the conversation. In this simulation no actual message is saved.' },
    { node: 'direct', edge: 'ui-direct', title: 'Persist the message', text: 'supabase-js sends an authenticated insert to the database API. RLS checks brand membership.' },
    { node: 'db', edge: 'direct-db', title: 'Store customer history', text: 'PostgreSQL stores the message, checks relationships, and serializes conversation writes.' },
    { node: 'generate', edge: 'ui-generate', title: 'Agent clicks Generate', text: 'The backend verifies access, loads order facts and recent messages, and claims a unique generation request.' },
    { node: 'retrieve', edge: 'generate-retrieve', title: 'Build the search context', text: 'The actual retrieval query includes recent customer context, not just the latest question.' },
    { node: 'cache', edge: 'retrieve-cache', title: 'Check the exact-query cache', text: cacheHit ? 'Simulated HIT: brand, query hash, revisions, configuration, and 24-hour expiry match.' : 'Simulated MISS: there is no reusable current cache entry.' },
    ...(cacheHit ? [] : [{ node: 'embed', edge: 'retrieve-embed', title: 'Embed the query', text: 'Gemini produces a 768-dimensional query vector. A provider failure falls back to keyword search.' }]),
    { node: 'db', edge: 'retrieve-db', title: cacheHit ? 'Reload current evidence' : 'Search brand policies', text: cacheHit ? 'Cached IDs are resolved to current policy text under agent permissions. No query embedding call.' : 'Brand-filtered keyword and vector candidates are combined; stale embeddings are excluded. Current results may be cached.' },
    { node: 'llm', edge: 'generate-llm', title: 'Draft with evidence', text: 'Gemini receives policies, conversation, and order facts. It selects evidence or abstains and returns a draft plus review flags.' },
    { node: 'generate', edge: 'llm-generate', title: 'Validate the output', text: 'The backend checks response shape, policy IDs, and exact quotes. These checks do not prove every claim is correct.' },
    { node: 'db', edge: 'generate-db', title: 'Save the audit record', text: 'Store original draft, evidence snapshots, model usage, and timing. Nothing has been sent yet.' },
    { node: 'ui', edge: '', title: 'Agent reviews and edits', text: 'Human review is required. This playback simulates approval; it never approves a real response.' },
    { node: 'approve', edge: 'ui-approve', title: 'Approve in one transaction', text: 'Check brand access and freshness. Reject changed messages or policies. A repeat request returns the existing sent message.' },
    { node: 'db', edge: 'approve-db', title: 'Commit final response', text: 'The final agent message and edited response audit are saved together. This does not issue a refund or replacement.' },
    { node: 'ui', edge: '', title: 'Customer sees the reply', text: 'The app adds the saved message to the conversation. Playback complete; no real API calls or database writes were performed.' },
  ], [cacheHit]);
  const activeStep = stepIndex >= 0 ? steps[stepIndex] : null;
  const activeId = activeStep?.node ?? selectedId;
  useEffect(() => {
    if (!activeStep || !flowInstance.current) return;
    const target = diagram.nodes.find(node => node.id === activeStep.node);
    if (!target) return;
    const bounds = flowInstance.current.getNodesBounds([target]);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void flowInstance.current.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { zoom: .95, duration: reduced ? 0 : 850 });
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
  return <>{view === 'flow' && <div className="playback-toolbar"><div className="playback-question"><label htmlFor="playback-question">Simulate a customer question</label><input id="playback-question" value={question} maxLength={500} onChange={event => setQuestion(event.target.value)} disabled={playing || stepIndex >= 0} /></div><label className="playback-branch">Cache path<select value={cacheHit ? 'hit' : 'miss'} disabled={stepIndex >= 0} onChange={event => setCacheHit(event.target.value === 'hit')}><option value="miss">Cache miss</option><option value="hit">Cache hit</option></select></label><label className="playback-speed">Pace<select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={3600}>Slow</option><option value={2600}>Normal</option><option value={1600}>Fast</option></select></label><button disabled={!question.trim()} onClick={() => { if (stepIndex < 0 || stepIndex === steps.length - 1) setStepIndex(0); setPlaying(value => !value); }}>{playing ? 'Pause' : stepIndex < 0 || stepIndex === steps.length - 1 ? 'Play flow' : 'Resume'}</button>{stepIndex >= 0 && <button className="secondary compact" onClick={() => { setPlaying(false); setStepIndex(-1); fitDiagram(); }}>Reset</button>}</div>}
  <div className={`design-layout ${activeStep ? 'with-playback' : showDetails ? 'with-details' : 'canvas-only'}`}><div className="design-canvas" aria-label={`${labels[view]} interactive diagram`}><ReactFlow<DesignNode>
    nodes={nodes}
    edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: .08, minZoom: .55, maxZoom: .85 }}
    panOnScroll={false} zoomOnScroll={!playing} zoomOnPinch={!playing} panOnDrag={!playing} zoomOnDoubleClick={false} preventScrolling
    onInit={instance => { flowInstance.current = instance; setZoom(instance.getZoom()); }}
    onMoveEnd={(_event, viewport) => setZoom(viewport.zoom)}
    minZoom={.15} maxZoom={2.5} nodesDraggable={false} nodesConnectable={false}
    edgesReconnectable={false} deleteKeyCode={null} onNodeClick={(_event, node) => { setPlaying(false); setStepIndex(-1); setSelectedId(node.id); setShowDetails(true); }}
  ><Background color="#b6c8ed" gap={22} /><MiniMap nodeColor="#dbe7ff" maskColor="rgba(37,99,235,.09)" pannable zoomable /></ReactFlow>
  <div className="canvas-zoom-controls" aria-label="Canvas zoom controls"><button className="secondary compact" aria-label="Zoom out" disabled={zoom <= .151} onClick={() => changeZoom(1 / 1.2)}>?</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button className="secondary compact" aria-label="Zoom in" disabled={zoom >= 2.499} onClick={() => changeZoom(1.2)}>+</button><button className="secondary compact" onClick={fitDiagram}>Fit all</button><button className="secondary compact" onClick={actualSize}>100%</button></div><button className="secondary compact canvas-details-toggle" onClick={() => setShowDetails(value => !value)}>{showDetails ? 'Hide details' : 'Show details'}</button></div>
  {activeStep && <div className="playback-caption" role="status"><div className="playback-caption-meta"><span>GUIDED SIMULATION ? {stepIndex + 1} / {steps.length}</span><span>{playing ? 'Playing' : stepIndex === steps.length - 1 ? 'Complete' : 'Paused'}</span></div><h3>{activeStep.title}</h3><p>{activeStep.text}</p><blockquote>{question}</blockquote><progress max={steps.length} value={stepIndex + 1} aria-label="Playback progress" /><div className="playback-step-buttons"><button className="secondary compact" disabled={stepIndex === 0} onClick={() => { setPlaying(false); setStepIndex(value => value - 1); }}>Previous</button><button className="secondary compact" disabled={stepIndex === steps.length - 1} onClick={() => { setPlaying(false); setStepIndex(value => value + 1); }}>Next</button></div></div>}
  {!activeStep && showDetails && <aside className="panel design-inspector" aria-live="polite"><span className="eyebrow">{selected.data.proposed ? 'PROPOSED AT SCALE' : 'CURRENT IMPLEMENTATION'}</span><h2>{selected.data.label}</h2><p className="muted">{selected.data.description}</p><h3>{view === 'database' ? 'Key fields' : 'Responsibilities'}</h3><ul>{selected.data.fields.map(field => <li key={field}>{field}</li>)}</ul><button className="secondary compact" aria-pressed={focusConnections} onClick={() => setFocusConnections(value => !value)}>{focusConnections ? 'Show all connections' : 'Focus node connections'}</button><h3>Safeguards & boundaries</h3><ul>{selected.data.safeguards.map(rule => <li key={rule}>{rule}</li>)}</ul><label htmlFor="design-node-select">Explore a component</label><select id="design-node-select" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{diagram.nodes.map(node => <option key={node.id} value={node.id}>{node.data.label}</option>)}</select></aside>}</div></>;
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
  return <section className={`design-workspace ${expanded ? 'design-expanded' : ''}`}><div className="design-compact-heading"><div><span className="eyebrow">ARCHITECTURE EXPLORER</span><h1>System design</h1></div><button className="secondary compact" onClick={() => setExpanded(value => !value)}>{expanded ? 'Exit fullscreen' : 'Fullscreen'}</button></div><div className="design-toolbar"><div className="mode-switch" aria-label="Diagram view">{(Object.keys(labels) as DesignView[]).map(key => <button key={key} className={view === key ? 'selected' : ''} aria-pressed={view === key} onClick={() => setView(key)}>{labels[key]}</button>)}</div><p className="muted small">Drag to pan ? Scroll or pinch to zoom ? Fit all resets the view</p></div>{view === 'scale' && <p className="design-scope-note">Proposed infrastructure for 500 brands / 5,000 agents; dashed blocks are not deployed.</p>}{view === 'database' && <p className="design-scope-note">Documented table relationships and key columns, not live database data.</p>}<Canvas key={view} view={view} /></section>;
}
