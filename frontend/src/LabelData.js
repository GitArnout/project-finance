import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';

const LabelData = () => {
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [labels, setLabels] = useState([]);
  const [updateMessage, setUpdateMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [excludeLabeled, setExcludeLabeled] = useState(false);
  const [showHighConfidence, setShowHighConfidence] = useState(false);

  const monthMapping = {
    1: 'January',
    2: 'February',
    3: 'March',
    4: 'April',
    5: 'May',
    6: 'June',
    7: 'July',
    8: 'August',
    9: 'September',
    10: 'October',
    11: 'November',
    12: 'December',
  };

  useEffect(() => {
    setLoading(true);
    fetch('/api/getlabelmonth')
      .then(response => response.json())
      .then(data => {
        setYears(data.years || []);
        setMonths(data.months || []);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching label months:', error);
        setLoading(false);
      });

    fetch('/api/getlabels')
      .then(response => response.json())
      .then(data => {
        const labelList = processLabels(data.details);
        setLabels(labelList);
      })
      .catch(error => console.error('Error fetching labels:', error));
  }, []);

  useEffect(() => {
    if (selectedYear && selectedMonth) {
      fetchTransactions(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth, excludeLabeled, showHighConfidence]);

  const processLabels = details => {
    const labelList = [];
    
    const traverse = (node, category) => {
      const currentCategory = category ? `${category} > ${node.name}` : node.name;
      if (node.labels && node.labels.length > 0) {
        node.labels.forEach(label => {
          labelList.push({ name: label.name, category: currentCategory });
        });
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, currentCategory));
      }
    };
    details.forEach(root => traverse(root, ''));
    return labelList;
  };

  const handleYearChange = e => {
    const year = e.target.value;
    setSelectedYear(year);
    fetchTransactions(year, selectedMonth);
  };

  const handleMonthChange = e => {
    const month = e.target.value;
    setSelectedMonth(month);
    fetchTransactions(selectedYear, month);
  };

  const fetchTransactions = (year, month) => {
    if (year && month) {
      setLoading(true);
      const monthName = monthMapping[parseInt(month, 10)];
      fetch(`/api/transactions?month=${monthName} ${year}`)
        .then(response => response.json())
        .then(data => {
          let filteredTransactions = data;
          if (excludeLabeled) {
            filteredTransactions = data.filter(t => !t.label);
          }
          if (showHighConfidence) {
            filteredTransactions = filteredTransactions.filter(t => t.label_probability >= 0.6);
          }
          filteredTransactions.sort((a, b) => (a.label ? 1 : -1));
          setTransactions(filteredTransactions);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching transactions:', error);
          setLoading(false);
        });
    }
  };

  const handleLabelUpdate = (transactionId, selectedLabel) => {
    if (selectedLabel !== 'Selecteer label voor transactie') {
      fetch('/api/updateLabel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId, labelName: selectedLabel }),
      })
        .then(response => response.json())
        .then(data => {
          setUpdateMessage(`De transactie: ${transactionId} is geupdate met label: ${selectedLabel}`);
          setTransactions(prevTransactions =>
            prevTransactions.filter(transaction => transaction.id !== transactionId)
          );
          setTimeout(() => setUpdateMessage(''), 10000);
        })
        .catch(error => console.error('Error updating label:', error));
    }
  };

  const handleApplySuggestedLabel = (transactionId, suggestedLabel) => {
    handleLabelUpdate(transactionId, suggestedLabel);
  };

  const Row = ({ transaction }) => {
    const [open, setOpen] = useState(false);

    return (
      <React.Fragment>
        <TableRow>
          <TableCell>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          </TableCell>
          <TableCell align="right">{transaction.datum}</TableCell>
          <TableCell align="right">{transaction.company}</TableCell>
          <TableCell align="right">€{parseFloat(transaction.bedrag_eur).toFixed(2)}</TableCell>
          <TableCell align="right">
            <FormControl variant="outlined" sx={{ minWidth: 250, width: 250 }}>
              <Select
                size="small"
                value={transaction.label || ''}
                displayEmpty
                onChange={(e) => handleLabelUpdate(transaction.id, e.target.value)}
                renderValue={(selected) => {
                  if (!selected) {
                    return <em>Selecteer label voor transactie</em>;
                  }
                  return selected;
                }}
                inputProps={{ style: { fontSize: '14px' } }}
                sx={{ fontSize: '14px' }}
              >
                <MenuItem disabled value="" sx={{ fontSize: 14 }}>
                  <em>Selecteer label voor transactie</em>
                </MenuItem>
                {labels.map((label) => (
                  <MenuItem key={label.name} value={label.name} sx={{ fontSize: 14 }}>
                    {label.category} &gt; {label.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </TableCell>
          <TableCell align="right">
            {transaction.suggested_label} ({Math.round(transaction.label_probability * 100)}%)
          </TableCell>
          <TableCell align="right">
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => handleApplySuggestedLabel(transaction.id, transaction.suggested_label)}
            >
              Apply
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box margin={1}>
                {/* Content to be defined later */}
                <Typography variant="h6" gutterBottom component="div">
                  Transaction Details
                </Typography>
                <Typography variant="body2">
                  <strong>Beschrijving:</strong> {transaction.company}
                </Typography>
                <Typography variant="body2">
                  <strong>Mutatiesoort:</strong> {transaction.mutatiesoort}
                </Typography>
                <Typography variant="body2">
                  <strong>Mededelingen:</strong> {transaction.mededelingen}
                </Typography>
                <Typography variant="body2">
                  <strong>Label:</strong> {transaction.label}
                </Typography>
                <Typography variant="body2">
                  <strong>Transaction ID:</strong> {transaction.id}
                </Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Select Year and Month
      </Typography>
      <Box display="flex" mb={3}>
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <Select size="small" value={selectedYear} onChange={handleYearChange} displayEmpty>
            <MenuItem value="" disabled>
              Select Year
            </MenuItem>
            {years.map(year => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <Select size="small" value={selectedMonth} onChange={handleMonthChange} displayEmpty>
            <MenuItem value="" disabled>
              Select Month
            </MenuItem>
            {months.map(month => (
              <MenuItem key={month} value={month}>
                {monthMapping[month]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <FormControlLabel
        control={<Checkbox checked={excludeLabeled} onChange={() => setExcludeLabeled(!excludeLabeled)} color="primary" />}
        label="Exclude labeled transactions"
      />
      <FormControlLabel
        control={<Checkbox checked={showHighConfidence} onChange={() => setShowHighConfidence(!showHighConfidence)} color="primary" />}
        label="Show transactions with label probability > 60%"
      />
      <Typography variant="h5" gutterBottom>
        Transactions
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={400}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small" aria-label="transactions table">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'rgb(25, 118, 210)' }}>
                <TableCell sx={{ color: 'white', paddingLeft: '10px' }}></TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Date</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Company</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Amount (€)</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Label</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Suggested Label</TableCell>
                <TableCell sx={{ color: 'white' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map(transaction => (
                <Row key={transaction.id} transaction={transaction} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar open={Boolean(updateMessage)} autoHideDuration={6000} onClose={() => setUpdateMessage('')}>
        <Alert onClose={() => setUpdateMessage('')} severity="success">
          {updateMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default LabelData;