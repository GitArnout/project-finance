import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './Home';
import LabelData from './LabelData';
import FinanceOverview from './FinanceOverview';
import LabelsPage from './LabelsPage';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

function App() {
  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Button color="inherit" component={Link} to="/">
              <Typography variant="button">Home</Typography>
            </Button>
            <Button color="inherit" component={Link} to="/labeldata">
              <Typography variant="button">Label Data</Typography>
            </Button>
            <Button color="inherit" component={Link} to="/finance-overview">
              <Typography variant="button">Finance Overview</Typography>
            </Button>
            <Button color="inherit" component={Link} to="/labels">
              <Typography variant="button">Labels</Typography>
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/labeldata" element={<LabelData />} />
        <Route path="/finance-overview" element={<FinanceOverview />} />
        <Route path="/labels" element={<LabelsPage />} />
      </Routes>
    </div>
  );
}

export default App;
