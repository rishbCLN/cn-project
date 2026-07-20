import React, { useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  Connection,
  Node, Edge,
  OnNodesChange,
  BackgroundVariant,
  ReactFlowInstance,
  NodeTypes,
  EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import DeviceNode from './DeviceNode';
import NetworkEdge from './NetworkEdge';
import { DeviceType } from '../../types';

const nodeTypes: NodeTypes = {
  device: DeviceNode,
};

const edgeTypes: EdgeTypes = {
  network: NetworkEdge,
};

import { PresetInfoCard } from '../dashboard/PresetInfoCard';

export const NetworkCanvas: React.FC = () => {
  const devices = useNetworkStore(s => s.devices);
  const links = useNetworkStore(s => s.links);
  const selectedDeviceId = useNetworkStore(s => s.selectedDeviceId);
  const addDevice = useNetworkStore(s => s.addDevice);
  const addLink = useNetworkStore(s => s.addLink);
  const removeLink = useNetworkStore(s => s.removeLink);
  const selectDevice = useNetworkStore(s => s.selectDevice);
  const selectLink = useNetworkStore(s => s.selectLink);
  const updateDevicePosition = useNetworkStore(s => s.updateDevicePosition);
  const showMinimap = useUIStore(s => s.showMinimap);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // Convert devices → React Flow nodes
  const nodes: Node[] = useMemo(() => {
    return devices.map(device => ({
      id: device.id,
      type: 'device',
      position: device.position,
      data: { device },
      selected: device.id === selectedDeviceId,
    }));
  }, [devices, selectedDeviceId]);

  // Convert links → React Flow edges
  const edges: Edge[] = useMemo(() => {
    return links.map(link => ({
      id: link.id,
      source: link.source,
      target: link.target,
      sourceHandle: link.sourceHandle,
      targetHandle: link.targetHandle,
      type: 'network',
      data: {
        utilization: link.utilization,
        status: link.status,
        bandwidth: link.bandwidth,
        latency: link.latency,
      },
    }));
  }, [links]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    for (const change of changes) {
      if (change.type === 'position' && change.dragging && change.position) {
        updateDevicePosition(change.id, change.position);
      }
    }
  }, [updateDevicePosition]);

  const startDraggingConnection = useUIStore(s => s.startDraggingConnection);
  const stopDraggingConnection = useUIStore(s => s.stopDraggingConnection);

  const onConnectStart = useCallback((_: any, { nodeId }: any) => {
    if (nodeId) {
      startDraggingConnection(nodeId);
    }
  }, [startDraggingConnection]);

  const onConnectEnd = useCallback(() => {
    stopDraggingConnection();
  }, [stopDraggingConnection]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      addLink(
        connection.source,
        connection.target,
        connection.sourceHandle,
        connection.targetHandle
      );
    }
    stopDraggingConnection();
  }, [addLink, stopDraggingConnection]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectDevice(node.id);
  }, [selectDevice]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectLink(edge.id);
  }, [selectLink]);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    removeLink(edge.id);
  }, [removeLink]);

  const onPaneClick = useCallback(() => {
    selectDevice(null);
    selectLink(null);
  }, [selectDevice, selectLink]);

  // Handle drop from sidebar
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/deviceType') as DeviceType;
    if (!type || !rfInstance.current) return;

    const position = rfInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    addDevice(type, position);
  }, [addDevice]);

  const isValidConnection = useCallback((connection: Connection) => {
    return connection.source !== connection.target;
  }, []);

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={(instance) => { rfInstance.current = instance; }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        connectionLineStyle={{ stroke: '#06b6d4', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: 'network' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls
          showInteractive={false}
          style={{ bottom: 16, left: 16 }}
        />
        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const device = node.data?.device;
              if (!device) return '#64748b';
              if (device.status === 'disabled') return '#374151';
              const colors: Record<string, string> = {
                router: '#3b82f6', switch: '#10b981',
                server: '#8b5cf6', pc: '#06b6d4',
              };
              return colors[device.type] ?? '#64748b';
            }}
            maskColor="rgba(10, 14, 26, 0.85)"
            style={{ bottom: 16, right: 16 }}
          />
        )}
      </ReactFlow>

      {/* ─── Preset Scenario Description Floating Banner ─── */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'auto',
      }}>
        <PresetInfoCard />
      </div>
    </div>
  );
};
