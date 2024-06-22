import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './Home';
import LabelData from './LabelData';

function App() {
  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/labeldata">Label Data</Link>
          </li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/labeldata" element={<LabelData />} />
      </Routes>
    </div>
  );
}

export default App;
