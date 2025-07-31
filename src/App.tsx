import React from 'react';
import { useAppStore } from './store/useAppStore';
import Home from './pages/Home';
import FileDetails from './pages/FileDetails';
import History from './pages/History';
import Settings from './pages/Settings';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  const { currentPage } = useAppStore();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'details':
        return <FileDetails />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'white',
            color: 'black',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          },
        }}
      />
    </div>
  );
};

export default App;