import React, { useEffect, useState } from 'react';
import axios from 'axios';

const LabelsTable = () => {
  const [labelsData, setLabelsData] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabelsData = async () => {
      try {
        console.log('Fetching labels data from /api/getlabels');
        const response = await axios.get('/api/getlabels');
        const { details } = response.data;
        console.log('Fetched labels data:', details);
        setLabelsData(details);

        console.log('Fetching transaction summary from /api/transactions/summary');
        const summaryResponse = await axios.get('/api/transactions/summary');
        console.log('Fetched transaction summary:', summaryResponse.data);
        setTransactionSummary(summaryResponse.data);

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

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getTotalForLabelAndMonth = (label, month) => {
    const summary = transactionSummary.find(item => item.label === label);
    return summary ? summary[month] : 0;
  };

  // Helper function to render nested categories and labels as a list
  const renderCategoriesAndLabels = (categories) => {
    return (
      <ul>
        {categories.map((category, idx) => (
          <li key={idx}>
            <strong>{category.name}</strong>
            {category.labels.length > 0 && (
              <ul>
                {category.labels.map((label, labelIdx) => (
                  <li key={labelIdx}>{label.name}</li>
                ))}
              </ul>
            )}
            {category.children.length > 0 && renderCategoriesAndLabels(category.children)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <h1>Labels Table</h1>
      <div>
        {renderCategoriesAndLabels(labelsData)}
      </div>
      <table border="1">
        <thead>
          <tr>
            <th>Category &gt; Label</th>
            {months.map((month, idx) => (
              <th key={idx}>{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labelsData.map((category, categoryIdx) => (
            <React.Fragment key={categoryIdx}>
              <tr>
                <td><strong>{category.name}</strong></td>
                {months.map((month, idx) => (
                  <td key={idx}></td>
                ))}
              </tr>
              {category.labels.map((label, labelIdx) => (
                <tr key={`${categoryIdx}-${labelIdx}`}>
                  <td style={{ paddingLeft: '20px' }}>{label.name}</td>
                  {months.map((month, idx) => (
                    <td key={idx}>{getTotalForLabelAndMonth(label.name, month)}</td>
                  ))}
                </tr>
              ))}
              {category.children.map((subCategory, subCategoryIdx) => (
                <React.Fragment key={`${categoryIdx}-${subCategoryIdx}`}>
                  <tr>
                    <td style={{ paddingLeft: '20px' }}><strong>{subCategory.name}</strong></td>
                    {months.map((month, idx) => (
                      <td key={idx}></td>
                    ))}
                  </tr>
                  {subCategory.labels.map((label, subLabelIdx) => (
                    <tr key={`${categoryIdx}-${subCategoryIdx}-${subLabelIdx}`}>
                      <td style={{ paddingLeft: '40px' }}>{label.name}</td>
                      {months.map((month, idx) => (
                        <td key={idx}>{getTotalForLabelAndMonth(label.name, month)}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LabelsTable;
