import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import { AppShell } from './components/layout/AppShell';

const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
};

export default App;
