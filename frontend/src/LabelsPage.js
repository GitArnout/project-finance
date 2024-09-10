import React, { useState, useEffect } from 'react';
import SortableTree, { SortableTreeWithoutDndContext as SortableTreeWithDnd } from '@nosferatu500/react-sortable-tree';
import '@nosferatu500/react-sortable-tree/style.css';
import { Typography, Button, Paper, Box, TextField, Grid, Container } from '@mui/material';
import axios from 'axios';
import { DndProvider, DragSource } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// External Node Type and DragSource Configuration
const externalNodeType = 'yourNodeType';
const externalNodeSpec = {
    beginDrag: (props) => ({ node: { ...props.node }, index: props.index }),
};
const externalNodeCollect = (connect) => ({
    connectDragSource: connect.dragSource(),
});
const ExternalNodeBaseComponent = ({ connectDragSource, node }) =>
    connectDragSource(
        <div style={{
            display: 'inline-block',
            padding: '6px 16px', // MUI Button padding
            backgroundColor: node.type === 'label' ? '#4caf50' : '#f50057',
            color: 'white',
            borderRadius: '4px',
            cursor: 'move',
            margin: '8px 0', // MUI Button margin
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            border: 'none',
            textAlign: 'center',
            lineHeight: '1.75', // Ensures consistent height with MUI button
        }}>
            {node.title}
        </div>,
        { dropEffect: 'copy' }
    );
const ExternalNodeComponent = DragSource(externalNodeType, externalNodeSpec, externalNodeCollect)(ExternalNodeBaseComponent);

// Function to transform the API response to the treeData structure
const mapLabelsToTreeData = (data) => {
    const transformNode = (node) => ({
        title: node.name,
        id: node.id,
        type: node.type,
        children: [
            ...node.children.map(transformNode),
            ...node.labels.map(label => ({
                title: label.name,
                id: label.id,
                categoryId: label.category_id,
                type: 'label',
                children: []
            }))
        ]
    });

    return data.map(transformNode);
};

const LabelsPage = () => {
    const [treeData, setTreeData] = useState([]);
    const [jsonPreview, setJsonPreview] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [externalNodes, setExternalNodes] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/api/getlabels');
                const treeData = mapLabelsToTreeData(response.data.details);
                setTreeData(treeData);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    const canDrop = ({ node, nextParent }) => {
        if (node.type === 'label') {
            return nextParent && nextParent.type === 'category';
        }
        return !(nextParent && nextParent.type === 'label');
    };

    const canDrag = ({ node }) => {
        const topLevelCategories = ['INKOMSTEN', 'UITGAVEN'];
        return !(node.type === 'category' && topLevelCategories.includes(node.title));
    };

    const getNodeStyle = (node) => {
        return node.type === 'label'
            ? { backgroundColor: '#e0f7fa', border: '1px solid #4fc3f7', padding: '5px' }
            : { backgroundColor: '#f5f5f5', border: '1px solid #ddd', padding: '5px' };
    };

    const expandAllNodes = (nodes) => {
        return nodes.map(node => ({
            ...node,
            expanded: true,
            children: expandAllNodes(node.children)
        }));
    };

    useEffect(() => {
        setJsonPreview(JSON.stringify(treeData, null, 2));
    }, [treeData]);

    const handleAddCategory = async () => {
        if (newCategory.trim() === '') {
            alert('Please enter a category name.');
            return;
        }

        try {
            const response = await axios.post('/api/add-category', { name: newCategory });
            const categoryId = response.data.id;

            const newCategoryNode = {
                title: newCategory,
                id: categoryId,
                type: 'category',
                children: [],
            };

            // Add to external nodes list
            setExternalNodes([...externalNodes, newCategoryNode]);
            setNewCategory('');
        } catch (error) {
            console.error('Error adding category:', error);
            alert('There was an error adding the category.');
        }
    };

    const handleAddLabel = async () => {
        if (newLabel.trim() === '') {
            alert('Please enter a label name.');
            return;
        }

        try {
            const response = await axios.post('/api/add-label', { name: newLabel });
            const labelId = response.data.id;

            const newLabelNode = {
                title: newLabel,
                id: labelId,
                type: 'label',
                children: [],
            };

            // Add to external nodes list
            setExternalNodes([...externalNodes, newLabelNode]);
            setNewLabel('');
        } catch (error) {
            console.error('Error adding label:', error);
            alert('There was an error adding the label.');
        }
    };

    const handleSubmit = async () => {
        try {
            await axios.post('/api/update_label_order', treeData);
            alert('Label order updated successfully!');
        } catch (error) {
            console.error('Error updating label order:', error);
            alert('There was an error updating the label order.');
        }
    };

    const handleDrop = (node) => {
        // Remove the node from the external nodes list
        const updatedExternalNodes = externalNodes.filter((externalNode) => externalNode.id !== node.id);
        setExternalNodes(updatedExternalNodes);
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Container maxWidth="lg" style={{ paddingTop: '20px' }}>
                <Grid container spacing={4}>
                    {/* Left Section: Tree Structure */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Label Page
                        </Typography>

                        <div style={{ height: '1500px', marginBottom: '20px' }}>
                            <SortableTreeWithDnd
                                treeData={expandAllNodes(treeData)}
                                onChange={(newTreeData) => {
                                    setTreeData(newTreeData);
                                }}
                                onMoveNode={({ node }) => handleDrop(node)}
                                canDrop={canDrop}
                                canDrag={canDrag}
                                dndType={externalNodeType}
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
                    </Grid>

                    {/* Right Section: Input Fields, JSON Preview, and External Nodes */}
                    <Grid item xs={12} md={6}>
                        {/* New Labels and Categories Section */}
                        <div style={{ marginBottom: '20px' }}>
                            <Typography variant="h6" component="h2" gutterBottom>
                                New Labels and Categories
                            </Typography>
                            {externalNodes.map((node, index) => (
                                <ExternalNodeComponent key={index} node={node} />
                            ))}
                        </div>

                        {/* Manage Labels and Categories Section */}
                        <Paper style={{ padding: '10px', marginBottom: '20px' }}>
                            <Typography variant="h6" component="h2" gutterBottom>
                                Manage Labels and Categories
                            </Typography>

                            <Grid container spacing={2} alignItems="center" style={{ marginBottom: '20px' }}>
                                <Grid item xs={5}>
                                    <TextField
                                        fullWidth
                                        label="New Category"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    <Button variant="contained" color="primary" onClick={handleAddCategory}>
                                        Add Category
                                    </Button>
                                </Grid>
                            </Grid>

                            <Grid container spacing={2} alignItems="center" style={{ marginBottom: '20px' }}>
                                <Grid item xs={5}>
                                    <TextField
                                        fullWidth
                                        label="New Label"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    <Button variant="contained" color="secondary" onClick={handleAddLabel}>
                                        Add Label
                                    </Button>
                                </Grid>
                            </Grid>

                            <Box mb={2}>
                                <Button variant="contained" color="primary" fullWidth onClick={handleSubmit}>
                                    Submit Changes
                                </Button>
                            </Box>
                        </Paper>

                        {/* JSON Preview Section */}
                        <Paper style={{ padding: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                            <Typography variant="h6" component="h2">
                                JSON Preview
                            </Typography>
                            <pre>{jsonPreview}</pre>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </DndProvider>
    );
};

export default LabelsPage;
