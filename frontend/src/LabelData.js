import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Paper,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert,
  Divider,
  Button, // Add this import for the button
} from '@mui/material';

const LabelData = () => {
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [labels, setLabels] = useState([]);
  const [updateMessage, setUpdateMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // New: Static suggested label for now
  const staticSuggestedLabel = 'Boodschappen';

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
  }, [selectedYear, selectedMonth]);

  const processLabels = details => {
    const labelList = [];
    const traverse = (node, category) => {
      const currentCategory = category ? `${category} > ${node.name}` : node.name;
      if (!node.children || node.children.length === 0) {
        node.labels.forEach(label => {
          labelList.push({ name: label.name, category: currentCategory });
        });
      } else {
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
          setTransactions(data);
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
          fetchTransactions(selectedYear, selectedMonth); // Refresh transactions after update
          setTimeout(() => setUpdateMessage(''), 10000);
        })
        .catch(error => console.error('Error updating label:', error));
    }
  };

  const handleApplySuggestedLabel = (transactionId) => {
    // For now, just use the staticSuggestedLabel
    handleLabelUpdate(transactionId, staticSuggestedLabel);
  };

  const separateTransactions = () => {
    const prefilled = transactions.filter(transaction => transaction.label);
    const nonPrefilled = transactions.filter(transaction => !transaction.label);
    return { prefilled, nonPrefilled };
  };

  const { prefilled, nonPrefilled } = separateTransactions();

  return (
    <Container sx={{ fontSize: '0.9em' }}>
      <Typography variant="h4" gutterBottom>
        Select Year and Month
      </Typography>
      <Box display="flex" justifyContent="space-between" mb={3}>
        <FormControl variant="outlined" sx={{ minWidth: 120 }}>
          <Select
            size="small"
            value={selectedYear}
            onChange={handleYearChange}
            displayEmpty
            sx={{  }}
          >
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
          <Select
            size="small"
            value={selectedMonth}
            onChange={handleMonthChange}
            displayEmpty
            sx={{  }}
          >
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
      <Divider sx={{ margin: '10px 0' }} />
      <Typography variant="h5" gutterBottom>
        Labelled Transactions
      </Typography>
      <Paper>
        {prefilled.length === 0 ? (
          <Typography variant="body2" align="center" padding={2}>
            No transactions with pre-filled labels.
          </Typography>
        ) : (
          <List>
            {prefilled.map((transaction, index) => (
              <React.Fragment key={index}>
                <ListItem sx={{ padding: '4px 16px', alignItems: 'center' }}>
                  <ListItemText
                    primary={`${transaction.datum} - ${transaction.company} - €${transaction.bedrag_eur !== undefined ? parseFloat(transaction.bedrag_eur).toFixed(2) : 'N/A'}`}
                  />
                  <Box display="flex" alignItems="center">
                    <FormControl variant="outlined" sx={{ minWidth: 250 }}>
                      <Select
                        size="small"
                        value={transaction.label || 'Selecteer label voor transactie'}
                        onChange={e => handleLabelUpdate(transaction.id, e.target.value)}
                        displayEmpty
                        sx={{ fontSize: '0.7em' }}
                      >
                        <MenuItem disabled>
                          Selecteer label voor transactie
                        </MenuItem>
                        {labels.map(label => (
                          <MenuItem key={label.name} value={label.name}>
                            {label.category} &gt; {label.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {/* New section for suggested label */}
                    <Typography variant="body2" sx={{ marginLeft: '16px' }}>
                      Suggested Label: {staticSuggestedLabel}
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      sx={{ marginLeft: '8px' }}
                      onClick={() => handleApplySuggestedLabel(transaction.id)}
                    >
                      Apply
                    </Button>
                  </Box>
                </ListItem>
                {index < prefilled.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
      <Divider sx={{ margin: '10px 0' }} />
      <Typography variant="h5" gutterBottom>
        Transactions without Labels
      </Typography>
      <Paper>
        {nonPrefilled.length === 0 ? (
          <Typography variant="body2" align="center" padding={2}>
            No transactions without labels.
          </Typography>
        ) : (
          <List>
            {nonPrefilled.map((transaction, index) => (
              <React.Fragment key={index}>
                <ListItem sx={{ padding: '4px 16px', alignItems: 'center' }}>
                  <ListItemText
                    primary={`${transaction.datum} - ${transaction.company} - €${transaction.bedrag_eur !== undefined ? parseFloat(transaction.bedrag_eur).toFixed(2) : 'N/A'}`}
                  />
                  <Box display="flex" alignItems="center">
                    <FormControl variant="outlined" sx={{ minWidth: 250 }}>
                      <Select
                        size="small"
                        value="Selecteer label voor transactie"
                        onChange={e => handleLabelUpdate(transaction.id, e.target.value)}
                        displayEmpty
                        sx={{ fontSize: '0.7em' }}
                      >
                        <MenuItem disabled>
                          Selecteer label voor transactie
                        </MenuItem>
                        {labels.map(label => (
                          <MenuItem key={label.name} value={label.name}>
                            {label.category} &gt; {label.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {/* New section for suggested label */}
                    <Typography variant="body2" sx={{ marginLeft: '16px' }}>
                      Suggested Label: {staticSuggestedLabel}
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      sx={{ marginLeft: '8px' }}
                      onClick={() => handleApplySuggestedLabel(transaction.id)}
                    >
                      Apply
                    </Button>
                  </Box>
                </ListItem>
                {index < nonPrefilled.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
      <Snackbar
        open={!!updateMessage}
        autoHideDuration={6000}
        onClose={() => setUpdateMessage('')}
      >
        <Alert onClose={() => setUpdateMessage('')} severity="success">
          {updateMessage}
        </Alert>
      </Snackbar>
      {loading && <CircularProgress />}
    </Container>
  );
};

export default LabelData;
