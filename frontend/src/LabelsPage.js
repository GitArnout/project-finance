import React, { useState, useEffect } from 'react';
import SortableTree from '@nosferatu500/react-sortable-tree';
import '@nosferatu500/react-sortable-tree/style.css';
import { Container, Typography, Button, Paper, Box } from '@mui/material';
import axios from 'axios';

// Function to transform the API response to the treeData structure
const mapLabelsToTreeData = (data) => {
    const transformNode = (node) => ({
        title: node.name,
        id: node.id, // Store the id for later reference
        type: node.type, // Use the type field from the API response
        children: [
            ...node.children.map(transformNode),
            ...node.labels.map(label => ({
                title: label.name,
                id: label.id,
                categoryId: label.category_id,
                type: 'label', // Labels have type 'label'
                children: []
            }))
        ]
    });

    return data.map(transformNode);
};

const LabelsPage = () => {
    const [treeData, setTreeData] = useState([]);
    const [jsonPreview, setJsonPreview] = useState('');

    useEffect(() => {
        // Fetch data from the API
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/getlabels'); // Updated API endpoint
                const treeData = mapLabelsToTreeData(response.data.details);
                setTreeData(treeData);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    // Function to check if a node can be dropped at a certain location
    const canDrop = ({ node, nextParent }) => {
        if (node.type === 'label') {
            // Labels can only be dropped under categories, not other labels
            return nextParent && nextParent.type === 'category';
        } else {
            // Categories cannot be dropped under labels
            return !(nextParent && nextParent.type === 'label');
        }
    };

    // Function to check if a node can be dragged
    const canDrag = ({ node }) => {
        // Prevent dragging of top-level categories like "INKOMSTEN" and "UITGAVEN"
        const topLevelCategories = ['INKOMSTEN', 'UITGAVEN'];
        return !(node.type === 'category' && topLevelCategories.includes(node.title));
    };

    // Function to customize node styling
    const getNodeStyle = (node) => {
        return node.type === 'label'
            ? { backgroundColor: '#e0f7fa', border: '1px solid #4fc3f7', padding: '5px' } // Light blue background for labels
            : { backgroundColor: '#f5f5f5', border: '1px solid #ddd', padding: '5px' }; // Light background for categories
    };

    // Function to ensure all nodes are expanded
    const expandAllNodes = (nodes) => {
        return nodes.map(node => ({
            ...node,
            expanded: true,
            children: expandAllNodes(node.children)
        }));
    };

    // Effect to update JSON preview
    useEffect(() => {
        setJsonPreview(JSON.stringify(treeData, null, 2));
    }, [treeData]);

    const handleSubmit = async () => {
        try {
            // Post the treeData to the update_label_order endpoint
            const response = await axios.post('/api/update_label_order', treeData);
            console.log('Response:', response.data);
            alert('Label order updated successfully!');
        } catch (error) {
            console.error('Error updating label order:', error);
            alert('There was an error updating the label order.');
        }
    };

    return (
      <Container>
        <Typography variant="h4" component="h1" gutterBottom>
          Label Page
        </Typography>
        <div style={{ height: '1500px' }}>
          <SortableTree
            treeData={expandAllNodes(treeData)}
            onChange={newTreeData => setTreeData(newTreeData)}
            canDrop={canDrop}
            canDrag={canDrag}
            generateNodeProps={({ node }) => ({
                title: (
                    <div style={getNodeStyle(node)}>
                        {node.title}
                        {node.type === 'label' && <input type="hidden" value={node.categoryId} />}
                    </div>
                ),
            })}
          />
        </div>
        <Box mt={2}>
            <Typography variant="h6" component="h2">
              JSON Preview
            </Typography>
            <Paper style={{ padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                <pre>{jsonPreview}</pre>
            </Paper>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              style={{ marginTop: '10px' }}
            >
              Submit
            </Button>
        </Box>
      </Container>
    );
};

export default LabelsPage;
