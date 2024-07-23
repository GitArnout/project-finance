import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Styled components for custom styling
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  [`&.${TableCell.head}`]: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  [`&.${TableCell.body}`]: {
    fontSize: 14,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const LabelsPage = () => {
  const [categoriesData, setCategoriesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/getlabels');
        const { details } = response.data;
        setCategoriesData(details);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedCategories = Array.from(categoriesData);
    const [movedCategory] = reorderedCategories.splice(result.source.index, 1);
    reorderedCategories.splice(result.destination.index, 0, movedCategory);

    setCategoriesData(reorderedCategories);
  };

  const renderCategoriesAndLabels = (categories, depth = 0) => {
    return categories.map((category, index) => (
      <Draggable key={category.id} draggableId={category.id.toString()} index={index}>
        {(provided) => (
          <React.Fragment>
            <StyledTableRow
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
            >
              <StyledTableCell colSpan={2} style={{ paddingLeft: depth * 20 }}>
                <Typography variant={depth === 0 ? "subtitle1" : "subtitle2"}><strong>{category.name}</strong></Typography>
              </StyledTableCell>
            </StyledTableRow>
            {category.labels.map(label => (
              <StyledTableRow key={label.id}>
                <StyledTableCell style={{ paddingLeft: (depth + 1) * 20 }}>{label.name}</StyledTableCell>
              </StyledTableRow>
            ))}
            {category.children && renderCategoriesAndLabels(category.children, depth + 1)}
          </React.Fragment>
        )}
      </Draggable>
    ));
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Container>
      <Typography variant="h4" gutterBottom>Labels</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} size="small" aria-label="labels table">
                  <TableHead>
                    <TableRow>
                      <StyledTableCell>Category/Label</StyledTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {renderCategoriesAndLabels(categoriesData)}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Droppable>
        </DragDropContext>
      </Box>
    </Container>
  );
};

export default LabelsPage;
