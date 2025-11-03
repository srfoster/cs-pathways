import { useCallback, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';

import 'reactflow/dist/style.css';
import sequences from '../data/sequences.json';
import './Overview.css';

// Extract YouTube video ID from URL
const getYouTubeVideoId = (url: string) => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Custom Video Node Component
const VideoNode = ({ data }: { data: any }) => {
  const videoId = getYouTubeVideoId(data.url);
  
  return (
    <div className="video-node">
      {/* Sequence flow handles */}
      <Handle type="target" position={Position.Left} id="sequence-in" />
      <Handle type="source" position={Position.Right} id="sequence-out" />
      
      {/* Prerequisite handles */}
      <Handle type="target" position={Position.Top} id="prereq-in" />
      <Handle type="source" position={Position.Bottom} id="prereq-out" />
      
      <div className="video-content">
        <div className="video-title">{data.title}</div>
        {videoId && (
          <div className="video-embed">
            <iframe
              width="280"
              height="158"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={data.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <div className="video-description">{data.description}</div>
        <a 
          href={data.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="video-link"
          style={{ backgroundColor: data.sequenceColor }}
          onClick={(e) => e.stopPropagation()}
        >
          Watch on YouTube
        </a>
      </div>
    </div>
  );
};

// Custom Sequence Header Node
const SequenceHeaderNode = ({ data }: { data: any }) => {
  return (
    <div 
      className="sequence-header-node" 
      style={{ 
        background: `linear-gradient(135deg, ${data.color}, ${data.color}cc)`,
      }}
    >
      <div className="sequence-title">{data.title}</div>
      <div className="sequence-description">{data.description}</div>
      
      {/* Sequence flow handle */}
      <Handle type="source" position={Position.Right} id="sequence-out" />
      
      {/* Prerequisite handle */}
      <Handle type="source" position={Position.Bottom} id="prereq-out" />
    </div>
  );
};

const nodeTypes = {
  videoNode: VideoNode,
  sequenceHeader: SequenceHeaderNode,
};



const Overview = () => {
  // Generate nodes and edges from sequences data
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    let yOffset = 0;
    const sequenceSpacing = 600; // Vertical space between sequences
    const videoSpacing = 420; // Horizontal space between videos
    
    // Process sequences in JSON order (AWS first, then Databases)
    // This puts AWS above Databases, minimizing crossings for the aws-1 -> db-10 dependency
    sequences.forEach((sequence) => {
      // Create sequence header node
      const headerNodeId = `sequence-${sequence.id}`;
      nodes.push({
        id: headerNodeId,
        type: 'sequenceHeader',
        position: { x: 0, y: yOffset },
        data: {
          title: sequence.title,
          description: sequence.description,
          color: sequence.color,
        },
      });
      
      // Create video nodes for this sequence
      sequence.videos.forEach((video, videoIndex) => {
        const nodeId = `${sequence.id}-${video.id}`;
        
        nodes.push({
          id: nodeId,
          type: 'videoNode',
          position: { 
            x: (videoIndex + 1) * videoSpacing, 
            y: yOffset 
          },
          data: {
            title: video.title,
            description: video.description,
            url: video.url,
            sequenceColor: sequence.color,
          },
        });
        
        // Create edge from header to first video
        if (videoIndex === 0) {
          edges.push({
            id: `${headerNodeId}-${nodeId}`,
            source: headerNodeId,
            sourceHandle: 'sequence-out',
            target: nodeId,
            targetHandle: 'sequence-in',
            type: 'smoothstep',
            style: { stroke: sequence.color, strokeWidth: 2 },
          });
        }
        
        // Create edge from previous video to current video
        if (videoIndex > 0) {
          const prevNodeId = `${sequence.id}-${sequence.videos[videoIndex - 1].id}`;
          edges.push({
            id: `${prevNodeId}-${nodeId}`,
            source: prevNodeId,
            sourceHandle: 'sequence-out',
            target: nodeId,
            targetHandle: 'sequence-in',
            type: 'smoothstep',
            style: { stroke: sequence.color, strokeWidth: 2 },
          });
        }
        
        // Create cross-sequence dependency edges
        if (video.dependencies) {
          video.dependencies.forEach((depId: string) => {
            const sourceNodeId = sequences.flatMap(seq => seq.videos)
              .find(v => v.id === depId) ? 
              `${sequences.find(seq => seq.videos.some(v => v.id === depId))?.id}-${depId}` : 
              null;
            
            if (sourceNodeId) {
              edges.push({
                id: `${sourceNodeId}-${nodeId}-dependency`,
                source: sourceNodeId,
                sourceHandle: 'prereq-out',
                target: nodeId,
                targetHandle: 'prereq-in',
                type: 'smoothstep',
                style: { 
                  stroke: '#ef4444', 
                  strokeWidth: 3, 
                  strokeDasharray: '8,4' 
                },
                label: '🔗 prerequisite',
                labelStyle: { 
                  fill: '#ef4444', 
                  fontWeight: 600,
                  fontSize: 12,
                },
                labelBgPadding: [8, 4],
                labelBgBorderRadius: 4,
                labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
              });
            }
          });
        }
      });
      
      yOffset += sequenceSpacing;
    });
    
    // Use manual layout optimized for learning sequences
    // This respects the JSON order and minimizes crossings better than Dagre
    
    return { initialNodes: nodes, initialEdges: edges };
  }, []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="overview-container">
      <div className="overview-header">
        <h1>Computer Science Learning Pathways</h1>
      </div>
      
      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4, minZoom: 0.05, maxZoom: 1.5 }}
          minZoom={0.02}
          maxZoom={2}
        >
          <Controls />
          <MiniMap 
            style={{
              height: 120,
              backgroundColor: '#f8f9fa',
            }}
            zoomable
            pannable
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
};

export default Overview;