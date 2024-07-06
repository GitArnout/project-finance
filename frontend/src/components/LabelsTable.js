// src/components/LabelsTable.js

import React, { useEffect, useState } from 'react';
import axios from 'axios';

const LabelsTable = () => {
  const [labelsData, setLabelsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabelsData = async () => {
      try {
        const response = await axios.get('/api/getlabels');
        const { details } = response.data;
        setLabelsData(details);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchLabelsData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Helper function to flatten the tree structure for table rendering
  const flattenTree = (nodes, level = 0) => {
    return nodes.reduce((acc, node) => {
      if (typeof node === 'string') {
        acc.push({ name: node, level });
      } else {
        const [key, children] = Object.entries(node)[0];
        acc.push({ name: key, level });
        acc = acc.concat(flattenTree(children, level + 1));
      }
      return acc;
    }, []);
  };

  const flattenedLabels = flattenTree(labelsData);

  // Generate months based on the number of labels (assuming months array is known)
  const months = ['January', 'February', 'March']; // Replace with actual months

  return (
    <div>
      <h1>Labels Table</h1>
      <table border="1">
        <thead>
          <tr>
            <th>Label</th>
            {months.map((month, idx) => (
              <th key={idx}>{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flattenedLabels.map((label, idx) => (
            <tr key={idx}>
              <td style={{ paddingLeft: `${label.level * 20}px` }}>{label.name}</td>
              {months.map((_, idx) => (
                <td key={idx}></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LabelsTable;
