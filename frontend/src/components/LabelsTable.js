import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';

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
  // Hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const LabelsTable = () => {
  const [labelsData, setLabelsData] = useState([]);
  const [transactionsData, setTransactionsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabelsData = async () => {
      try {
        const response = await axios.get('/api/getlabels');
        const { details } = response.data;
        setLabelsData(details);

        const transactionsResponse = await axios.get('/api/transactions/summary');
        setTransactionsData(transactionsResponse.data);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchLabelsData();
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getTotalForLabelAndMonth = (label, month) => {
    const transaction = transactionsData.find((data) => data.label === label);
    return transaction ? transaction[month] : 0;
  };

  const renderCategoriesAndLabels = (categories) => {
    return categories.map((category) => (
      <React.Fragment key={category.id}>
        <StyledTableRow>
          <StyledTableCell colSpan={13} style={{ backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1"><strong>{category.name}</strong></Typography>
          </StyledTableCell>
        </StyledTableRow>
        {category.labels.map((label) => (
          <StyledTableRow key={label.id}>
            <StyledTableCell>{label.name}</StyledTableCell>
            {months.map((month) => (
              <StyledTableCell key={month}>{getTotalForLabelAndMonth(label.name, month)}</StyledTableCell>
            ))}
          </StyledTableRow>
        ))}
        {category.children.map((subCategory) => (
          <React.Fragment key={subCategory.id}>
            <StyledTableRow>
              <StyledTableCell colSpan={13} style={{ paddingLeft: '20px', backgroundColor: '#f9f9f9' }}>
                <Typography variant="subtitle2"><strong>{subCategory.name}</strong></Typography>
              </StyledTableCell>
            </StyledTableRow>
            {subCategory.labels.map((subLabel) => (
              <StyledTableRow key={subLabel.id}>
                <StyledTableCell style={{ paddingLeft: '40px' }}>{subLabel.name}</StyledTableCell>
                {months.map((month) => (
                  <StyledTableCell key={month}>{getTotalForLabelAndMonth(subLabel.name, month)}</StyledTableCell>
                ))}
              </StyledTableRow>
            ))}
          </React.Fragment>
        ))}
      </React.Fragment>
    ));
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>Labels Table</Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
          <TableHead>
            <TableRow>
              <StyledTableCell>Category &gt; Label</StyledTableCell>
              {months.map((month) => (
                <StyledTableCell key={month}>{month}</StyledTableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {renderCategoriesAndLabels(labelsData)}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default LabelsTable;
