
document.addEventListener("DOMContentLoaded", function () {
    const yearFilter = document.getElementById("yearFilter");
    const chartYearFilter = document.getElementById("chartYearFilter");
    const currentYear = new Date().getFullYear();
  
    // Populate Year Filters (Last 5 years including current year)
    for (let i = currentYear - 4; i <= currentYear; i++) {
      yearFilter.innerHTML += `<option value="${i}">${i}</option>`;
      chartYearFilter.innerHTML += `<option value="${i}">${i}</option>`;
    }
  
    // Preserve selected filter values from URL
    const params = new URLSearchParams(window.location.search);
    yearFilter.value = params.get("year") || currentYear;
    chartYearFilter.value = params.get("year") || currentYear;
    document.getElementById("syllabusFilter").value = params.get("syllabus") || "All";
    document.getElementById("classFilter").value = params.get("class") || "All";
    document.getElementById("chartSyllabusFilter").value = params.get("syllabus") || "All";
  
    // Apply filters to table
    function applyFilters() {
      const syllabus = document.getElementById("syllabusFilter").value;
      const classValue = document.getElementById("classFilter").value;
      const year = document.getElementById("yearFilter").value;
      
      const url = new URL(window.location.href);
      syllabus === "All" ? url.searchParams.delete("syllabus") : url.searchParams.set("syllabus", syllabus);
      classValue === "All" ? url.searchParams.delete("class") : url.searchParams.set("class", classValue);
      year ? url.searchParams.set("year", year) : url.searchParams.delete("year");
      
      window.location.href = url.toString();
    }
  
    document.getElementById("chartSyllabusFilter").addEventListener("change", updateChart);
    document.getElementById("chartYearFilter").addEventListener("change", updateChart);
  
    function updateChart() {
    const selectedSyllabus = document.getElementById("chartSyllabusFilter").value;
    const selectedYear = document.getElementById("chartYearFilter").value;
    const ctx = document.getElementById("studentsChart").getContext("2d");
  
    fetch(`/get-stats?syllabus=${selectedSyllabus}&year=${selectedYear}`)
      .then(response => response.json())
      .then(statsData => {
        console.log("Chart Data:", statsData);
  
        if (window.currentChart) {
          window.currentChart.destroy();
        }
  
        const labels = Object.keys(statsData["STATE"]);
        const stateData = Object.values(statsData["STATE"]);
        const icseData = Object.values(statsData["ICSE"]);
        const cbseData = Object.values(statsData["CBSE"]);
  
        window.currentChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "STATE",
                data: stateData,
                backgroundColor: "rgba(5, 243, 84, 0.7)",
                borderColor: "#05f354",
                borderWidth: 2,
              },
              {
                label: "ICSE",
                data: icseData,
                backgroundColor: "rgba(54, 162, 235, 0.7)",
                borderColor: "#36a2eb",
                borderWidth: 2,
              },
              {
                label: "CBSE",
                data: cbseData,
                backgroundColor: "rgba(255, 99, 132, 0.7)",
                borderColor: "#ff6384",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 10,
                  callback: value => `${value} students`,
                },
                suggestedMax: Math.ceil(Math.max(...stateData, ...icseData, ...cbseData) / 10) * 10,
              },
              x: {
                title: { display: true, text: "Class" },
                ticks: {
                  autoSkip: false, // Prevents labels from being skipped
                  maxRotation: window.innerWidth < 600 ? 45 : 0, // Rotates labels for small screens
                  minRotation: window.innerWidth < 600 ? 45 : 0,
                  font: {
                    size: window.innerWidth < 600 ? 10 : 12, // Adjust font size for smaller screens
                  },
                },
              },
            },
            plugins: {
              legend: {
                position: window.innerWidth < 600 ? "bottom" : "top", // Moves legend below chart on mobile
              },
              title: {
                display: true,
                text: `Student Distribution - ${selectedSyllabus} (${selectedYear})`,
                font: { size: window.innerWidth < 600 ? 14 : 18 }, // Smaller title font for mobile
              },
            },
          },
        });
      })
      .catch(error => console.error("Chart Fetch Error:", error));
  }
  
  
    updateChart();
  });
  
      // Table filter functionality
      function applyFilters() {
        const syllabus = document.getElementById('syllabusFilter').value;
        const classValue = document.getElementById('classFilter').value;
        const url = new URL(window.location.href);
        
        if (syllabus === 'All') {
          url.searchParams.delete('syllabus');
        } else {
          url.searchParams.set('syllabus', syllabus);
        }
        
        if (classValue === 'All') {
          url.searchParams.delete('class');
        } else {
          url.searchParams.set('class', classValue);
        }
        
        window.location.href = url.toString();
      }
  
      // Pagination functionality
      function changePage(page) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    window.location.href = url.toString();
  }
  
  
      // Set initial filter values
      document.addEventListener("DOMContentLoaded", function() {
        const params = new URLSearchParams(window.location.search);
        document.getElementById("syllabusFilter").value = params.get("syllabus") || "All";
        document.getElementById("classFilter").value = params.get("class") || "All";
      });
    
    // Add this script to your approved_list.ejs file

      // Function to generate USN when entry is approved
      async function generateUSN(id, syllabus) {
        try {
          const response = await fetch('/update-usn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, syllabus })
          });
          
          const data = await response.json();
          if (data.success) {
            // Update the USN in the table
            const usnCell = document.querySelector(`tr[data-id="${id}"] td.usn-cell`);
            if (usnCell) {
              usnCell.textContent = data.usn;
            }
          } else {
            console.error('Error generating USN:', data.error);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      }
    
      // Add event listener for approved entries
      document.addEventListener('DOMContentLoaded', function() {
        const entries = document.querySelectorAll('tr[data-id]');
        entries.forEach(entry => {
          const id = entry.dataset.id;
          const syllabus = entry.dataset.syllabus;
          const usnCell = entry.querySelector('.usn-cell');
          
          if (!usnCell.textContent || usnCell.textContent === 'N/A') {
            generateUSN(id, syllabus);
          }
        });
      });
      