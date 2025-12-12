// ============================================
// LECTURER DASHBOAD
// ============================================
let classChartInstance = null;
let currentRiskStudents = [];
let allStudentScores = [];
let participationChartInstance = null;
let materialUsageChartInstance = null;
let currentModuleCode = null;
let currentRiskFilter = 'all';
let currentFilteredStudents = [];
let sortDirection = { id: "asc", score: "asc" };

async function loadLecturerData(moduleCode) {
    if (!moduleCode) {
        moduleCode = document.getElementById("module").value;
    }

    currentModuleCode = moduleCode;

    const loadingEl = document.getElementById("loadingMessage");
    if (loadingEl) {
        loadingEl.style.display = "flex";
        loadingEl.innerHTML = `
            <div class="spinner-border spinner-border-sm text-info me-2" role="status"></div>
            <span>Loading lecturer data for ${moduleCode}...</span>
        `;
    }

    try {
        const res = await fetch(`/api/lecturer/${moduleCode}`);
        const data = await res.json();

        console.log('📊 Lecturer data received:', data);
        window.currentLecturerData = data;

        renderLecturerSummary(data);
        renderClassPerformance(data.scores, moduleCode);
        renderRiskStudents(data.scores);
        renderParticipationTrends(data.trends);
        renderModuleDeadlinesEnhanced(data, moduleCode);
        renderEngagementWarningsEnhanced(data, moduleCode);
        renderMaterialUsageEnhanced(data, moduleCode);
        renderTimeAnalysisEnhanced(data, moduleCode);
        renderStudentEngagement(data, moduleCode);

        if (loadingEl) {
            loadingEl.innerHTML = "✅ Lecturer data loaded";
            setTimeout(() => { loadingEl.style.display = "none"; }, 2000);
        }
    } catch (error) {
        console.error("Error loading lecturer data:", error);
        if (loadingEl) {
            loadingEl.innerHTML = "❌ Error loading data";
        }
    }
}

function renderLecturerSummary(data) {
    const scores = data.scores.map(s => Number(s.score));
    allStudentScores = data.scores;
    const totalStudents = Array.isArray(data.students) ? data.students.length : data.students;
    const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // Update Total Students
    document.getElementById("totalStudents").innerText = totalStudents;

    // Update Average Score
    document.getElementById("avgClassScore").innerText = avgScore.toFixed(2) + "%";

    // Update Performance Badge
    const badge = document.querySelector("#avgClassScore + .badge");
    if (badge) {
        if (avgScore >= 80) {
            badge.textContent = "Excellent";
            badge.className = "badge bg-success";
        } else if (avgScore >= 60) {
            badge.textContent = "Good";
            badge.className = "badge bg-info";
        } else if (avgScore >= 40) {
            badge.textContent = "Moderate";
            badge.className = "badge bg-warning";
        } else {
            badge.textContent = "Poor";
            badge.className = "badge bg-danger";
        }
    }

    // NEW: Update At-Risk Students Card
    const atRiskStudents = scores.filter(s => s < 40);
    const criticalStudents = scores.filter(s => s < 30);
    const moderateStudents = scores.filter(s => s >= 30 && s < 40);

    document.getElementById("atRiskCount").innerText = atRiskStudents.length;
    document.getElementById("criticalCount").innerText = criticalStudents.length;
    document.getElementById("moderateCount").innerText = moderateStudents.length;

    // NEW: Update Top Performers Count
    const topPerformers = scores.filter(s => s >= 70);
    document.getElementById("topPerformersCount").innerText = topPerformers.length;
}  // ← This closes renderLecturerSummary

function drillDownAtRisk() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // Show the hidden sections with smooth reveal (Risk + Engagement focus)
    const sectionsToReveal = ['participation', 'materials', 'timeanalysis', 'engagement', 'studentEngagement'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    // Filter to show all at-risk students
    filterRiskLevel('all');
}

function renderClassPerformance(scores, moduleCode) {
    const perfScores = scores.map(s => Number(s.score));
    const ranges = {
        "0-39 (Fail)": perfScores.filter(s => s >= 0 && s <= 39).length,
        "40-59 (Pass)": perfScores.filter(s => s >= 40 && s <= 59).length,
        "60-79 (Merit)": perfScores.filter(s => s >= 60 && s <= 79).length,
        "80-100 (Distinction)": perfScores.filter(s => s >= 80 && s <= 100).length
    };

    if (classChartInstance) classChartInstance.destroy();

    const ctx = document.getElementById("classChart");
    if (!ctx) return;

    classChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: `Assessments in ${moduleCode}`,
                data: Object.values(ranges),
                backgroundColor: ["#dc3545", "#ffc107", "#0d6efd", "#198754"],
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Count: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Number of Assessments" }
                },
                x: {
                    title: { display: true, text: "Score Ranges" }
                }
            }
        }
    });
}

function renderRiskStudents(scores) {
    currentRiskStudents = scores.filter(s => Number(s.score) < 40);
    currentRiskFilter = 'all';
    filterRiskLevel('all');
}

function renderParticipationTrends(trends) {
    if (participationChartInstance) participationChartInstance.destroy();

    const ctx = document.getElementById("participationChart");
    if (!ctx) return;

    participationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => `Day ${t.day}`),
            datasets: [{
                label: "Total Clicks",
                data: trends.map(t => t.clicks),
                borderColor: "#3498db",
                backgroundColor: "rgba(52, 152, 219, 0.1)",
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Days since course start" } },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Total Clicks" }
                }
            }
        }
    });
}

function renderModuleDeadlinesEnhanced(data, moduleCode) {
    const container = document.getElementById("moduleDeadlines");
    if (!container) return;

    const assessments = generateModuleAssessments(moduleCode, data);
    const currentDay = data.scores && data.scores.length > 0
        ? Math.max(...data.scores.map(s => Number(s.date_submitted || 0))) + 5
        : 50;

    let totalStudents = 50;
    if (typeof data.students === 'number') {
        totalStudents = data.students;
    } else if (Array.isArray(data.students)) {
        totalStudents = data.students.length;
    } else if (data.scores && data.scores.length > 0) {
        totalStudents = new Set(data.scores.map(s => s.id_student)).size;
    }

    const getSubmissionCount = (assessment, currentDay, totalStudents) => {
        const daysUntilDue = assessment.date - currentDay;
        if (daysUntilDue > 20) {
            return Math.floor(totalStudents * (Math.random() * 0.2));
        } else if (daysUntilDue > 10) {
            return Math.floor(totalStudents * (0.2 + Math.random() * 0.3));
        } else if (daysUntilDue > 3) {
            return Math.floor(totalStudents * (0.5 + Math.random() * 0.25));
        } else if (daysUntilDue > 0) {
            return Math.floor(totalStudents * (0.75 + Math.random() * 0.15));
        } else if (daysUntilDue >= -3) {
            return Math.floor(totalStudents * (0.85 + Math.random() * 0.1));
        } else {
            return Math.floor(totalStudents * (0.9 + Math.random() * 0.08));
        }
    };

    const upcoming = assessments.filter(a => a.date > currentDay);
    const past = assessments.filter(a => a.date <= currentDay);

    let html = '<div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">';

    if (upcoming.length > 0) {
        html += '<div class="fw-bold text-warning p-2 bg-light"><i class="bi bi-clock me-2"></i>Upcoming Deadlines</div>';
        upcoming.slice(0, 5).forEach(assessment => {
            const daysLeft = assessment.date - currentDay;
            const urgencyClass = daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warning' : 'success';
            const submitted = getSubmissionCount(assessment, currentDay, totalStudents);
            const submissionRate = totalStudents > 0 ? ((submitted / totalStudents) * 100).toFixed(0) : 0;

            let statusMessage = '';
            if (submissionRate < 30) {
                statusMessage = '<small class="text-muted d-block mt-1">⏳ Early stage</small>';
            } else if (submissionRate < 60) {
                statusMessage = '<small class="text-info d-block mt-1">📈 Submissions increasing</small>';
            } else if (submissionRate < 80) {
                statusMessage = '<small class="text-success d-block mt-1">✅ Good progress</small>';
            }

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${assessment.type}</strong>
                            <span class="badge bg-secondary ms-2">${assessment.weight}%</span>
                            <br>
                            <small class="text-muted">Due: Day ${assessment.date}</small>
                            ${statusMessage}
                        </div>
                        <span class="badge bg-${urgencyClass} rounded-pill">${daysLeft} days left</span>
                    </div>
                    <div class="progress" style="height: 22px;">
                        <div class="progress-bar ${submissionRate >= 80 ? 'bg-success' : submissionRate >= 50 ? 'bg-warning' : 'bg-danger'}" 
                             style="width: ${submissionRate}%" 
                             role="progressbar">
                            ${submitted}/${totalStudents} (${submissionRate}%)
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `
            <div class="alert alert-success mb-0">
                <i class="bi bi-check-circle me-2"></i>
                No upcoming deadlines - all assessments completed!
            </div>
        `;
    }

    if (past.length > 0) {
        html += '<div class="fw-bold text-muted p-2 bg-light mt-2"><i class="bi bi-check-circle me-2"></i>Recent Assessments</div>';
        past.slice(-3).forEach(assessment => {
            const submitted = getSubmissionCount(assessment, currentDay, totalStudents);
            const submissionRate = totalStudents > 0 ? ((submitted / totalStudents) * 100).toFixed(0) : 0;
            const missing = totalStudents - submitted;

            let warningBadge = '';
            if (missing > totalStudents * 0.2) {
                warningBadge = `<span class="badge bg-danger ms-2">${missing} missing</span>`;
            }

            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <strong>${assessment.type}</strong>
                            <span class="badge bg-secondary ms-2">${assessment.weight}%</span>
                            ${warningBadge}
                            <br>
                            <small class="text-muted">Completed: Day ${assessment.date}</small>
                        </div>
                        <span class="badge ${submissionRate >= 90 ? 'bg-success' : submissionRate >= 75 ? 'bg-info' : 'bg-warning'}">
                            ${submissionRate}%
                        </span>
                    </div>
                    <div class="progress mt-2" style="height: 8px;">
                        <div class="progress-bar ${submissionRate >= 90 ? 'bg-success' : submissionRate >= 75 ? 'bg-info' : 'bg-warning'}" 
                             style="width: ${submissionRate}%" 
                             role="progressbar">
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderEngagementWarningsEnhanced(data, moduleCode) {
    const container = document.getElementById("engagementWarnings");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning mb-0">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>No engagement data available</strong>
                <p class="mb-0 small mt-2">VLE interaction data will appear here</p>
            </div>`;
        return;
    }

    const recentTrends = data.trends.slice(-5);
    const avgRecentClicks = recentTrends.reduce((sum, t) => sum + t.clicks, 0) / recentTrends.length;
    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const avgOverall = totalClicks / data.trends.length;

    const declining = avgRecentClicks < avgOverall * 0.7;
    const lowOverall = avgOverall < 30;

    const failingCount = data.scores ? data.scores.filter(s => s.score < 40).length : 0;
    const totalStudents = data.students || 50;
    const highRiskPercent = ((failingCount / totalStudents) * 100).toFixed(0);

    let html = '';

    if (failingCount > 0 && failingCount >= totalStudents * 0.2) {
        html += `
            <div class="alert alert-danger d-flex align-items-start mb-3">
                <i class="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">🚨 CRITICAL: ${failingCount} Students Failing</strong>
                    <p class="mb-2 small">${highRiskPercent}% of class below passing grade in ${moduleCode}</p>
                    <button class="btn btn-sm btn-danger" onclick="viewHighRiskStudents()">
                        <i class="bi bi-eye me-1"></i>View Details
                    </button>
                </div>
            </div>
        `;
    }

    if (declining) {
        html += `
            <div class="alert alert-warning d-flex align-items-start mb-3">
                <i class="bi bi-graph-down fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">⚠️ Declining Engagement Detected</strong>
                    <p class="mb-0 small">Recent VLE activity (${avgRecentClicks.toFixed(0)} clicks) is 30% below average</p>
                </div>
            </div>
        `;
    }

    if (lowOverall) {
        html += `
            <div class="alert alert-info d-flex align-items-start mb-3">
                <i class="bi bi-info-circle fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <strong class="d-block mb-1">ℹ️ Low Overall Engagement</strong>
                    <p class="mb-0 small">Average ${avgOverall.toFixed(0)} clicks per day. Consider adding interactive content.</p>
                </div>
            </div>
        `;
    }

    if (html === '') {
        html = `
            <div class="alert alert-success d-flex align-items-center mb-0">
                <i class="bi bi-check-circle-fill fs-3 me-3"></i>
                <div>
                    <strong class="d-block mb-1">✅ Healthy Engagement!</strong>
                    <p class="mb-0 small">No major concerns in ${moduleCode}</p>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderMaterialUsageEnhanced(data, moduleCode) {
    const container = document.getElementById("materialUsageChart");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.parentElement.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-file-earmark-bar-graph fs-1 d-block mb-3"></i>
                <p class="mb-2">No material usage data available</p>
                <small class="text-muted">Chart will appear when students access ${moduleCode} materials</small>
            </div>
        `;
        return;
    }

    const ctx = container.getContext('2d');

    const materials = [
        'Course Overview', 'Lecture Notes', 'Video Lectures', 'Practice Problems',
        'Discussion Forum', 'Quiz', 'Assignment Brief', 'Reading Materials',
        'Lab Instructions', 'Past Papers'
    ];

    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const materialClicks = materials.map((name, i) => ({
        name: name,
        clicks: Math.floor(totalClicks / materials.length * (0.5 + Math.random() * 1.5))
    }));

    materialClicks.sort((a, b) => b.clicks - a.clicks);
    const top10 = materialClicks.slice(0, 10);

    if (materialUsageChartInstance) {
        materialUsageChartInstance.destroy();
    }

    materialUsageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(m => m.name),
            datasets: [{
                label: 'Total Clicks',
                data: top10.map(m => m.clicks),
                backgroundColor: [
                    'rgba(108, 117, 125, 0.8)',
                    'rgba(108, 117, 125, 0.75)',
                    'rgba(108, 117, 125, 0.7)',
                    'rgba(108, 117, 125, 0.65)',
                    'rgba(108, 117, 125, 0.6)',
                    'rgba(108, 117, 125, 0.55)',
                    'rgba(108, 117, 125, 0.5)',
                    'rgba(108, 117, 125, 0.45)',
                    'rgba(108, 117, 125, 0.4)',
                    'rgba(108, 117, 125, 0.35)'
                ],
                borderColor: '#6c757d',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Most Accessed Materials in ${moduleCode}`,
                    font: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Clicks' },
                    ticks: { precision: 0 }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderTimeAnalysisEnhanced(data, moduleCode) {
    const container = document.getElementById("timeAnalysis");
    if (!container) return;

    if (!data.trends || data.trends.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle me-2"></i>
                <strong>No engagement data available</strong>
                <p class="mb-0 small mt-2">Time analysis will appear when students interact with ${moduleCode}</p>
            </div>`;
        return;
    }

    let totalStudents = 50;
    if (typeof data.students === 'number') {
        totalStudents = data.students;
    } else if (Array.isArray(data.students)) {
        totalStudents = data.students.length;
    } else if (data.scores && data.scores.length > 0) {
        totalStudents = new Set(data.scores.map(s => s.id_student)).size;
    }

    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);
    const avgClicksPerStudent = totalStudents > 0 ? (totalClicks / totalStudents).toFixed(1) : '0';

    const peakTrend = data.trends.reduce((max, t) => t.clicks > max.clicks ? t : max, data.trends[0]);
    const peakDay = peakTrend.day;

    const avgClicks = totalClicks / data.trends.length;
    const engagementLevel = avgClicks > 50 ? 'High' : avgClicks > 25 ? 'Medium' : 'Low';
    const engagementColor = avgClicks > 50 ? 'success' : avgClicks > 25 ? 'warning' : 'danger';

    container.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-mouse fs-1 text-primary mb-2"></i>
                        <h3 class="mb-1">${totalClicks.toLocaleString()}</h3>
                        <small class="text-muted">Total Interactions</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-person-check fs-1 text-info mb-2"></i>
                        <h3 class="mb-1">${avgClicksPerStudent}</h3>
                        <small class="text-muted">Avg per Student</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-calendar-event fs-1 text-success mb-2"></i>
                        <h3 class="mb-1">Day ${peakDay}</h3>
                        <small class="text-muted">Peak Activity</small>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 bg-light h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-speedometer2 fs-1 text-${engagementColor} mb-2"></i>
                        <h3 class="mb-1">${engagementLevel}</h3>
                        <small class="text-muted">Engagement</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="alert alert-${engagementColor} mt-3 mb-0">
            <i class="bi bi-lightbulb me-2"></i>
            <strong>Insight:</strong> ${avgClicksPerStudent} avg interactions per student in ${moduleCode}.
            ${avgClicks < 25 ? ' 📉 Consider adding more interactive elements.' :
            avgClicks > 50 ? ' 🎉 Excellent engagement!' : ' 📊 Moderate engagement.'}
        </div>
    `;
}

function renderStudentEngagement(data, moduleCode) {
    if (!data.trends || data.trends.length === 0 || !data.scores) {
        return;
    }

    // Calculate engagement per student based on VLE clicks
    const studentEngagement = [];
    const totalDays = data.trends.length;
    const totalClicks = data.trends.reduce((sum, t) => sum + t.clicks, 0);

    // Get unique students
    const uniqueStudents = [...new Set(data.scores.map(s => s.id_student))];

    uniqueStudents.forEach(studentId => {
        // Simulate student-specific clicks (in real scenario, use actual data)
        const studentScore = data.scores.find(s => s.id_student === studentId);
        const score = studentScore ? Number(studentScore.score) : 50;

        // High performers tend to have higher engagement
        let avgClicksPerDay;
        if (score >= 80) {
            avgClicksPerDay = 15 + Math.random() * 15; // 15-30 clicks/day
        } else if (score >= 60) {
            avgClicksPerDay = 10 + Math.random() * 10; // 10-20 clicks/day
        } else if (score >= 40) {
            avgClicksPerDay = 5 + Math.random() * 10; // 5-15 clicks/day
        } else {
            avgClicksPerDay = Math.random() * 8; // 0-8 clicks/day
        }

        let engagementLevel, engagementColor, engagementBg;
        if (avgClicksPerDay >= 20) {
            engagementLevel = 'High';
            engagementColor = '#198754';
            engagementBg = '#d1e7dd';
        } else if (avgClicksPerDay >= 10) {
            engagementLevel = 'Medium';
            engagementColor = '#ffc107';
            engagementBg = '#fff3cd';
        } else {
            engagementLevel = 'Low';
            engagementColor = '#dc3545';
            engagementBg = '#f8d7da';
        }

        // Calculate last active (simulate)
        const daysAgo = Math.floor(Math.random() * 7);
        const lastActive = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

        studentEngagement.push({
            id: studentId,
            avgClicks: avgClicksPerDay,
            level: engagementLevel,
            color: engagementColor,
            bg: engagementBg,
            lastActive: lastActive,
            score: score
        });
    });

    // Store globally for filtering
    window.allStudentEngagement = studentEngagement;
    window.currentEngagementFilter = 'all';

    // Render the table
    filterEngagement('all');
}

// Filter engagement function
function filterEngagement(level) {
    if (!window.allStudentEngagement) return;

    window.currentEngagementFilter = level;

    // Update button states
    ['engAll', 'engHigh', 'engMedium', 'engLow'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active');
        }
    });

    const activeBtn = document.getElementById(`eng${level.charAt(0).toUpperCase() + level.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Filter students
    let filtered = window.allStudentEngagement;
    if (level !== 'all') {
        filtered = window.allStudentEngagement.filter(s =>
            s.level.toLowerCase() === level
        );
    }

    // Sort by engagement (low to high for concern)
    filtered.sort((a, b) => a.avgClicks - b.avgClicks);

    renderEngagementTable(filtered);
}

// Render engagement table
function renderEngagementTable(students) {
    const tbody = document.getElementById('studentEngagementTable');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-3">
                    No students in this category
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr style="background-color: ${s.bg};" class="engagement-row" data-student='${JSON.stringify(s)}'>
            <td><strong>${s.id}</strong></td>
            <td>${s.avgClicks.toFixed(1)}</td>
            <td>
                <span class="badge" style="background-color: ${s.color};">
                    ${s.level}
                </span>
            </td>
            <td>${s.lastActive}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick='viewStudentEngagementDetails(${JSON.stringify(s)})'>
                    <i class="bi bi-eye"></i> View Details
                </button>
            </td>
        </tr>
    `).join('');
}

// Make functions global
window.filterEngagement = filterEngagement;
window.renderStudentEngagement = renderStudentEngagement;

// ============================================
// DRILL-DOWN FUNCTIONS (SHAFFER'S 4 C'S)
// ============================================

function drillDownTotalStudents() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // FIRST: Reveal participation/engagement sections
    const sectionsToReveal = ['participation', 'materials', 'timeanalysis', 'engagement'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    setTimeout(() => {
        showStudentBreakdownModal();
    }, 800);

    setTimeout(() => {
        showEngagementPage();
    }, 800);
}

// NEW: Separate function for student breakdown modal
function showStudentBreakdownModal() {
    const scores = allStudentScores.map(s => Number(s.score));
    const categories = {
        'Distinction (80-100%)': scores.filter(s => s >= 80).length,
        'Merit (60-79%)': scores.filter(s => s >= 60 && s < 80).length,
        'Pass (40-59%)': scores.filter(s => s >= 40 && s < 60).length,
        'Fail (0-39%)': scores.filter(s => s < 40).length
    };

    const modal = createDrillDownModal(`${currentModuleCode} - Student Performance Breakdown`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | Total Students: ${allStudentScores.length}
        </div>
        <div class="row g-3">
            ${Object.entries(categories).map(([name, count]) => {
        const percentage = ((count / scores.length) * 100).toFixed(1);
        let bgColor, borderColor, iconColor;

        if (name.includes('Distinction')) {
            bgColor = '#d1e7dd';
            borderColor = '#198754';
            iconColor = '#198754';
        } else if (name.includes('Merit')) {
            bgColor = '#cfe2ff';
            borderColor = '#0d6efd';
            iconColor = '#0d6efd';
        } else if (name.includes('Pass')) {
            bgColor = '#fff3cd';
            borderColor = '#ffc107';
            iconColor = '#ffc107';
        } else {
            bgColor = '#f8d7da';
            borderColor = '#dc3545';
            iconColor = '#dc3545';
        }

        return `
                    <div class="col-md-6">
                        <div class="card h-100" style="border: 2px solid ${borderColor}; background-color: ${bgColor};">
                            <div class="card-body text-center">
                                <h5 style="color: ${iconColor};">${name}</h5>
                                <h2 class="display-4" style="color: ${iconColor};">${count}</h2>
                                <p class="text-muted mb-0">${percentage}% of class</p>
                                <div class="progress mt-2" style="height: 8px;">
                                    <div class="progress-bar" style="width: ${percentage}%; background-color: ${iconColor};"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
        <div class="alert alert-info mt-3 mb-0">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Teaching Insight for ${currentModuleCode}:</strong> ${categories['Fail (0-39%)'] > scores.length * 0.2 ?
            'High failure rate detected. Consider review sessions or additional support materials.' :
            'Performance distribution is healthy. Continue current teaching approach.'}
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

function drillDownClassScore() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // FIRST: Reveal sections with animation (Performance storyline ONLY)
    const sectionsToReveal = ['risk', 'deadlines'];

    sectionsToReveal.forEach((sectionId, index) => {
        const section = document.getElementById(sectionId);
        if (section) {
            setTimeout(() => {
                section.style.display = 'block';
                section.style.opacity = '0';
                section.style.transform = 'translateY(20px)';
                section.style.transition = 'all 0.5s ease';

                // Show close button
                const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);
                if (closeBtn) closeBtn.style.display = 'inline-block';

                setTimeout(() => {
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        }
    });

    setTimeout(() => {
        showPerformanceModal();
    }, 800);
}

// Calculate WHY a student is at risk
function calculateRiskReasons(student, data) {
    const score = Number(student.score);
    const studentId = student.id_student;
    const reasons = [];

    // Simulate assessment submissions (in real app, get from actual data)
    const totalAssessments = 5;
    const submittedAssessments = score >= 70 ? 5 :
        score >= 40 ? Math.floor(3 + Math.random() * 2) :
            Math.floor(Math.random() * 3);
    const missingAssessments = totalAssessments - submittedAssessments;

    // Simulate VLE clicks
    const totalClicks = data.trends ? data.trends.reduce((sum, t) => sum + t.clicks, 0) : 0;
    const avgClicksPerStudent = totalClicks / (data.students || 50);
    // At-risk students tend to have lower engagement
    const studentClicks = score >= 40 ? avgClicksPerStudent * (0.8 + Math.random() * 0.4) :
        avgClicksPerStudent * (0.2 + Math.random() * 0.3);

    // Simulate last login
    const daysInactive = score < 30 ? Math.floor(Math.random() * 15) + 5 :
        score < 40 ? Math.floor(Math.random() * 10) :
            Math.floor(Math.random() * 5);

    const isCritical = score < 30;

    // CRITICAL REASONS (< 30%)
    if (isCritical) {
        if (missingAssessments >= 2) {
            reasons.push(`❗ ${missingAssessments} missing submissions`);
        }
        if (score < 25) {
            reasons.push(`❗ Failed assessment(s)`);
        }
        if (studentClicks < 20) {
            reasons.push(`❗ Low engagement (${Math.floor(studentClicks)} VLE clicks)`);
        }
        if (daysInactive > 7) {
            reasons.push(`❗ No login for ${daysInactive} days`);
        }
    }
    // MODERATE REASONS (30-39%)
    else {
        if (missingAssessments >= 1) {
            reasons.push(`⚠ ${missingAssessments} late submission(s)`);
        }
        if (score >= 30 && score < 35) {
            reasons.push(`⚠ Low quiz scores`);
        }
        if (studentClicks >= 20 && studentClicks < 50) {
            reasons.push(`⚠ Medium engagement (${Math.floor(studentClicks)} VLE clicks)`);
        }
        if (daysInactive >= 3 && daysInactive <= 7) {
            reasons.push(`⚠ Irregular activity (last login ${daysInactive} days ago)`);
        }
    }

    // If no specific reasons found, add generic one
    if (reasons.length === 0) {
        reasons.push(isCritical ? '❗ Poor assessment performance' : '⚠ Below passing threshold');
    }

    return {
        reasons: reasons,
        missingTasks: missingAssessments,
        vleClicks: Math.floor(studentClicks),
        lastActive: daysInactive
    };
}

// NEW: Separate function for the detailed modal
function showPerformanceModal() {
    const topPerformers = [...allStudentScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    const atRiskStudents = [...allStudentScores]
        .filter(s => Number(s.score) < 40)
        .sort((a, b) => a.score - b.score);

    const avgScore = allStudentScores.reduce((sum, s) => sum + Number(s.score), 0) / allStudentScores.length;

    const modal = createDrillDownModal(`${currentModuleCode} - Performance Deep Dive`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | 
            Class Average: ${avgScore.toFixed(1)}% | 
            Total Students: ${allStudentScores.length}
        </div>
        <div class="row g-4">
            <div class="col-md-6">
                <div class="card border-success h-100">
                    <div class="card-header" style="background-color: #198754; color: white;">
                        <i class="bi bi-trophy me-2"></i>
                        <strong>Top 10 Performers in ${currentModuleCode}</strong>
                        <small class="d-block mt-1">Learn from their success patterns</small>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        <div class="list-group list-group-flush">
                            ${topPerformers.map((s, idx) => {
        const score = Number(s.score);
        const bgColor = score >= 80 ? '#d1e7dd' : score >= 60 ? '#cfe2ff' : '#fff3cd';
        const textColor = score >= 80 ? '#198754' : score >= 60 ? '#0d6efd' : '#ffc107';
        return `
                                <div class="list-group-item d-flex justify-content-between align-items-center" style="background-color: ${bgColor};">
                                    <div>
                                        <span class="badge me-2" style="background-color: ${textColor};">#${idx + 1}</span>
                                        <strong>${s.id_student}</strong>
                                    </div>
                                    <span class="badge rounded-pill" style="background-color: ${textColor};">${s.score}%</span>
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card border-danger h-100">
                    <div class="card-header" style="background-color: #dc3545; color: white;">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>At-Risk Students (${atRiskStudents.length})</strong>
                        <small class="d-block mt-1">Require immediate intervention</small>
                    </div>
                    <div class="card-body" style="max-height: 400px; overflow-y: auto;">
                        ${atRiskStudents.length > 0 ? `
                           <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Student ID</th>
                                            <th>Score</th>
                                            <th>Risk Level</th>
                                            <th>Reasons</th>
                                        </tr>
                                    </thead>
                                <tbody>
            ${atRiskStudents.map(s => {
            const score = Number(s.score);
            const isCritical = score < 30;
            const bgColor = isCritical ? '#f8d7da' : '#ffd6d9';  // Light red
            const badgeColor = isCritical ? '#dc3545' : '#e85d75';
            const label = isCritical ? 'CRITICAL' : 'MODERATE';

            // Get the data object (need to pass it from parent)
            const riskData = window.currentLecturerData ?
                calculateRiskReasons(s, window.currentLecturerData) :
                { reasons: ['Data unavailable'], missingTasks: 0, vleClicks: 0, lastActive: 0 };

            return `
                <tr style="background-color: ${bgColor};">
                    <td><strong>${s.id_student}</strong></td>
                    <td>
                        <span class="badge" style="background-color: ${badgeColor};">${s.score}%</span>
                    </td>
                    <td>
                        <span class="badge" style="background-color: ${badgeColor};">${label}</span>
                    </td>
                    <td>
                        <small>
                            ${riskData.reasons.map(r => `<div class="mb-1">${r}</div>`).join('')}
                        </small>
                        <button class="btn btn-xs btn-outline-primary mt-1" onclick='viewStudentRiskDetails(${JSON.stringify(s)})'>
                            <i class="bi bi-eye"></i> Full Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('')}
        </tbody>
    </table>
</div>
                            </div>
                            <div class="alert alert-warning mt-3 mb-0">
                                <i class="bi bi-lightbulb me-2"></i>
                                <strong>Recommended Actions for ${currentModuleCode}:</strong>
                                <ul class="mb-0 mt-2">
                                    <li>Schedule 1-on-1 consultations</li>
                                    <li>Provide supplementary materials</li>
                                    <li>Enable peer mentoring programs</li>
                                </ul>
                            </div>
                        ` : `
                            <div class="alert alert-success mb-0">
                                <i class="bi bi-check-circle me-2"></i>
                                No students at risk in ${currentModuleCode}! Excellent class performance.
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>

        <div class="alert alert-info mt-3 mb-0">
            <i class="bi bi-graph-up me-2"></i>
            <strong>${currentModuleCode} Statistics:</strong>
            ${topPerformers.length} top performers | 
            ${atRiskStudents.length} need support | 
            ${((atRiskStudents.length / allStudentScores.length) * 100).toFixed(0)}% at risk
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

function drillDownTopPerformers() {
    if (!allStudentScores || allStudentScores.length === 0) {
        alert('Please load a module first');
        return;
    }

    // USE ONLY CURRENT MODULE DATA
    const highPerformers = [...allStudentScores]
        .filter(s => Number(s.score) >= 70)
        .sort((a, b) => b.score - a.score);

    const modal = createDrillDownModal(`${currentModuleCode} - High Performers (${highPerformers.length} students)`, `
        <div class="alert alert-primary mb-3">
            <strong>Module: ${currentModuleCode}</strong> | 
            High Performers (70%+): ${highPerformers.length} out of ${allStudentScores.length} students
        </div>
        <div class="card" style="border: 2px solid #198754;">
            <div class="card-header" style="background-color: #198754; color: white;">
                <i class="bi bi-stars me-2"></i>
                <strong>Students Scoring 70% and Above in ${currentModuleCode}</strong>
                <small class="d-block mt-1">Potential peer mentors and teaching assistants</small>
            </div>
            <div class="card-body" style="max-height: 500px; overflow-y: auto;">
                ${highPerformers.length > 0 ? `
                    <div class="row g-2">
                        ${highPerformers.map(s => {
        const score = Number(s.score);
        // Use shades of GREEN only (consistent colors)
        let bgColor, badgeColor, intensity;

        if (score >= 90) {
            bgColor = '#d1e7dd';  // Light green
            badgeColor = '#198754'; // Dark green
            intensity = 'Exceptional';
        } else if (score >= 80) {
            bgColor = '#d1e7dd';  // Light green
            badgeColor = '#20c997'; // Medium green
            intensity = 'Excellent';
        } else {
            bgColor = '#e7f5ec';  // Very light green
            badgeColor = '#28a745'; // Standard green
            intensity = 'Good';
        }

        return `
                            <div class="col-md-6">
                                <div class="card mb-2" style="border: 1px solid ${badgeColor}; background-color: ${bgColor};">
                                    <div class="card-body p-2 d-flex justify-content-between align-items-center">
                                        <div>
                                            <i class="bi bi-award me-2" style="color: ${badgeColor};"></i>
                                            <strong>${s.id_student}</strong>
                                            <small class="d-block text-muted">${intensity}</small>
                                        </div>
                                        <span class="badge" style="background-color: ${badgeColor};">${s.score}%</span>
                                    </div>
                                </div>
                            </div>
                        `;
    }).join('')}
                    </div>
                    <div class="alert alert-success mt-3 mb-0">
                        <i class="bi bi-lightbulb me-2"></i>
                        <strong>Engagement Ideas for ${currentModuleCode}:</strong>
                        <ul class="mb-0 mt-2">
                            <li>Invite top students to mentor struggling peers</li>
                            <li>Feature their work as exemplars</li>
                            <li>Offer advanced enrichment activities</li>
                        </ul>
                    </div>
                ` : `
                    <div class="alert alert-warning mb-0">
                        No students currently scoring above 70% in ${currentModuleCode}. Consider reviewing assessment difficulty.
                    </div>
                `}
            </div>
        </div>
    `);

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// Function to collapse/hide sections
function collapseSection(sectionId) {
    const section = document.getElementById(sectionId);
    const closeBtn = document.getElementById(`close${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`);

    if (section) {
        section.style.transition = 'all 0.3s ease';
        section.style.opacity = '0';
        section.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            section.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'none';
        }, 300);
    }
}

// Make it globally available
window.collapseSection = collapseSection;

// ============================================
// EXPORT FUNCTIONS
// ============================================
function exportModuleToExcel() {
    if (!currentModuleCode) {
        alert('Please select a module first');
        return;
    }
    const data = {
        module: currentModuleCode,
        totalStudents: document.getElementById("totalStudents")?.textContent || 0,
        avgScore: document.getElementById("avgClassScore")?.textContent || '0%',
        atRiskCount: currentRiskStudents.length,
        timestamp: new Date().toLocaleString()
    };

    let csv = `Module Performance Report\n\n`;
    csv += `Module Code,${data.module}\n`;
    csv += `Total Students,${data.totalStudents}\n`;
    csv += `Average Score,${data.avgScore}\n`;
    csv += `At-Risk Students,${data.atRiskCount}\n`;
    csv += `Generated,${data.timestamp}\n\n`;

    csv += `\nAt-Risk Students (Score < 40%)\n`;
    csv += `Student ID,Score,Status\n`;
    currentRiskStudents.forEach(s => {
        csv += `${s.id_student},${s.score}%,At Risk\n`;
    });

    downloadCSV(csv, `${currentModuleCode}_Report_${Date.now()}.csv`);
}
function exportAttendanceReport() {
    if (!currentModuleCode) {
        alert('Please select a module first');
        return;
    }
    let csv = `Attendance Report - ${currentModuleCode}\n\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    csv += `Student ID,Status,Last Active\n`;
    csv += `Sample attendance data - integrate with your VLE logs\n`;

    downloadCSV(csv, `${currentModuleCode}_Attendance_${Date.now()}.csv`);
}
function viewTeachingLog() {
    const logContainer = document.getElementById("teachingLog");
    if (!logContainer) return;
    const isVisible = logContainer.style.display !== 'none';
    logContainer.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        const tbody = document.getElementById("teachingLogTable");
        if (tbody) {
            tbody.innerHTML = `
            <tr>
                <td>2024-11-01</td>
                <td><span class="badge bg-primary">Uploaded Materials</span></td>
                <td>Week 5 lecture notes for ${currentModuleCode}</td>
            </tr>
            <tr>
                <td>2024-11-03</td>
                <td><span class="badge bg-success">Graded Assessment</span></td>
                <td>TMA 2 - ${currentRiskStudents.length} students</td>
            </tr>
            <tr>
                <td>2024-11-05</td>
                <td><span class="badge bg-info">Updated Content</span></td>
                <td>Added practice problems</td>
            </tr>
            <tr>
                <td>2024-11-07</td>
                <td><span class="badge bg-warning">Sent Notification</span></td>
                <td>Reminder for upcoming deadline</td>
            </tr>
        `;
        }
    }
}
function viewHighRiskStudents() {
    const riskSection = document.getElementById("risk");
    if (riskSection) {
        riskSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        riskSection.style.transition = 'background-color 0.3s ease';
        riskSection.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
        setTimeout(() => {
            riskSection.style.backgroundColor = '';
        }, 2000);
    }
}
function generateModuleAssessments(moduleCode, data) {
    const currentDay = data.scores && data.scores.length > 0
        ? Math.max(...data.scores.map(s => Number(s.date_submitted || 0))) + 5
        : 50;
    return [
        { id: `${moduleCode}_TMA1`, type: 'TMA 1', date: Math.max(10, currentDay - 30), weight: 15 },
        { id: `${moduleCode}_TMA2`, type: 'TMA 2', date: currentDay + 10, weight: 15 },
        { id: `${moduleCode}_CMA`, type: 'Computer Marked Assessment', date: currentDay + 30, weight: 20 },
        { id: `${moduleCode}_TMA3`, type: 'TMA 3', date: currentDay + 50, weight: 15 },
        { id: `${moduleCode}_EXAM`, type: 'Final Exam', date: currentDay + 75, weight: 35 }
    ];
}
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function filterRiskLevel(level) {
    if (!currentRiskStudents || currentRiskStudents.length === 0) {
        return;
    }

    currentRiskFilter = level;

    ['riskAll', 'riskCritical', 'riskModerate'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active', 'btn-danger', 'btn-warning');
            btn.classList.add('btn-light');
        }
    });

    const activeBtn = document.getElementById(`risk${level.charAt(0).toUpperCase() + level.slice(1)}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-light');
        if (level === 'critical') {
            activeBtn.classList.add('btn-danger', 'active');
        } else if (level === 'moderate') {
            activeBtn.classList.add('btn-danger', 'active');
        } else {
            activeBtn.classList.add('btn-light', 'active');
        }
    }

    if (level === 'critical') {
        currentFilteredStudents = currentRiskStudents.filter(s => Number(s.score) < 30);
    } else if (level === 'moderate') {
        currentFilteredStudents = currentRiskStudents.filter(s => Number(s.score) >= 30 && Number(s.score) < 40);
    } else {
        currentFilteredStudents = [...currentRiskStudents];
    }

    renderRiskTable(currentFilteredStudents, level);
}

function renderRiskTable(students, filterLevel = 'all') {
    const interventionMessages = {
        'critical': '🚨 URGENT: Immediate 1-on-1 consultation required',
        'moderate': '⚠️ WARNING: Early intervention recommended',
        'all': 'ℹ️ Students requiring support'
    };

    const tableHeader = `
        <tr>
            <th onclick="sortRiskTable('id')" style="cursor: pointer;">
                ID <i class="bi bi-arrow-down-up"></i>
            </th>
            <th onclick="sortRiskTable('score')" style="cursor: pointer;">
                Score <i class="bi bi-arrow-down-up"></i>
            </th>
            <th>Risk Level</th>
        </tr>`;

    const tableRows = students.length > 0 ? students
        .map(s => {
            const score = Number(s.score);
            const isCritical = score < 30;

            // Consistent colors: Red for Critical, Orange for Moderate
            const bgColor = isCritical ? '#f8d7da' : '#ffd6d9';  // Light red
            const badgeColor = isCritical ? '#dc3545' : '#e85d75';
            const riskLabel = isCritical ? 'CRITICAL' : 'MODERATE';

            return `
            <tr style="background-color: ${bgColor};">
                <td><strong>${s.id_student}</strong></td>
                <td><span class="badge" style="background-color: ${badgeColor};">${s.score}%</span></td>
                <td><span class="badge" style="background-color: ${badgeColor};">${riskLabel}</span></td>
            </tr>
        `;
        }).join("") :
        `<tr><td colspan="3" class="text-center text-muted py-3">
            <i class="bi bi-check-circle fs-3 text-success d-block mb-2"></i>
            No students in this category
        </td></tr>`;

    const alertColor = filterLevel === 'critical' ? '#dc3545' : (filterLevel === 'moderate' ? '#ffd6d9' : '#0d6efd');
    const alertBg = filterLevel === 'critical' ? '#f8d7da' : (filterLevel === 'moderate' ? '#ffe5d0' : '#cfe2ff');

    const message = students.length > 0 ?
        `<div class="alert mb-2" style="background-color: ${alertBg}; border-color: ${alertColor}; color: ${alertColor};">
            ${interventionMessages[filterLevel]}
            <strong class="d-block mt-1">${students.length} student(s) found</strong>
        </div>` : '';

    document.getElementById("riskTable").innerHTML = message + tableHeader + tableRows;
}

function sortRiskTable(by) {
    if (by === "id") {
        currentFilteredStudents.sort((a, b) =>
            sortDirection.id === "asc"
                ? Number(a.id_student) - Number(b.id_student)
                : Number(b.id_student) - Number(a.id_student)
        );
        sortDirection.id = sortDirection.id === "asc" ? "desc" : "asc";
    } else if (by === "score") {
        currentFilteredStudents.sort((a, b) =>
            sortDirection.score === "asc"
                ? Number(a.score) - Number(b.score)
                : Number(b.score) - Number(a.score)
        );
        sortDirection.score = sortDirection.score === "asc" ? "desc" : "asc";
    }
    renderRiskTable(currentFilteredStudents, currentRiskFilter);
}

function createDrillDownModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">
                        <i class="bi bi-zoom-in me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    return modal;
}

/* ================================
   UNIVERSAL NAVIGATION HELPERS
================================= */

// Hide the entire dashboard content (fixes spacing issue)
function hideDashboard() {
    const dashboard = document.querySelector('.content');
    if (dashboard) dashboard.style.display = 'none';
}

// Show the dashboard again
function showDashboard() {
    const dashboard = document.querySelector('.content');
    if (dashboard) dashboard.style.display = 'block';
}

// Hide all level-2 pages
function hideAllPages() {
    document.getElementById('atRiskPage').style.display = 'none';
    document.getElementById('engagementPage').style.display = 'none';
    document.getElementById('performancePage').style.display = 'none';
}


/* ================================
      PAGE NAVIGATION FUNCTIONS
================================= */

// ----- At-Risk Page -----
function showAtRiskPage() {
    hideDashboard();           // FIX: removes top spacing
    hideAllPages();

    const p = document.getElementById('atRiskPage');
    p.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.currentLecturerData) {
        populateAtRiskPage(window.currentLecturerData);
    }
}

// ----- Engagement Page -----
function showEngagementPage() {
    hideDashboard();
    hideAllPages();

    const p = document.getElementById('engagementPage');
    p.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.currentLecturerData) {
        populateEngagementPage(window.currentLecturerData);
    }
}

// ----- Performance Page -----
function showPerformancePage() {
    hideDashboard();
    hideAllPages();

    const p = document.getElementById('performancePage');
    p.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.currentLecturerData) {
        populatePerformancePage(window.currentLecturerData);
    }
}


/* ================================
        BACK TO DASHBOARD
================================= */

function backToDashboard() {
    hideAllPages();
    showDashboard();      // FIX: restores dashboard
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// POPULATE AT-RISK PAGE
// ============================================
function populateAtRiskPage(data) {
    if (!data || !data.scores) return;

    const atRiskStudents = data.scores.filter(s => Number(s.score) < 40);

    // Update count badge
    document.getElementById('atRiskPageCount').textContent =
        `${atRiskStudents.length} ${atRiskStudents.length === 1 ? 'Student' : 'Students'}`;

    // Store for filtering
    window.atRiskPageStudents = atRiskStudents;

    // Show all by default
    filterRiskPageLevel('all');

    // Populate engagement warnings
    const warningsContainer = document.getElementById('atRiskPageEngagementWarnings');
    if (warningsContainer) {
        warningsContainer.innerHTML = document.getElementById('engagementWarnings').innerHTML;
    }

    // Populate deadlines
    const deadlinesContainer = document.getElementById('atRiskPageDeadlines');
    if (deadlinesContainer) {
        deadlinesContainer.innerHTML = document.getElementById('moduleDeadlines').innerHTML;
    }
}

// Filter at-risk page by level
function filterRiskPageLevel(level) {
    if (!window.atRiskPageStudents) return;

    // Update button states
    ['riskPageAll', 'riskPageCritical', 'riskPageModerate'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`riskPage${level.charAt(0).toUpperCase() + level.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Filter students
    let filtered = window.atRiskPageStudents;
    if (level === 'critical') {
        filtered = window.atRiskPageStudents.filter(s => Number(s.score) < 30);
    } else if (level === 'moderate') {
        filtered = window.atRiskPageStudents.filter(s => Number(s.score) >= 30 && Number(s.score) < 40);
    }

    // Render table
    renderAtRiskPageTable(filtered);
}

// Render at-risk page table
function renderAtRiskPageTable(students) {
    const tbody = document.getElementById('atRiskPageTable');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    <i class="bi bi-check-circle fs-1 text-success d-block mb-3"></i>
                    <p>No students in this category</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map(s => {
        const score = Number(s.score);
        const isCritical = score < 30;
        const bgColor = isCritical ? '#f8d7da' : '#ffd6d9';  // Light red
        const badgeColor = isCritical ? '#dc3545' : '#e85d75';
        const label = isCritical ? 'CRITICAL' : 'MODERATE';

        // Calculate reasons
        const riskData = window.currentLecturerData ?
            calculateRiskReasons(s, window.currentLecturerData) :
            { reasons: ['Data unavailable'] };

        return `
            <tr style="background-color: ${bgColor};">
                <td><strong>${s.id_student}</strong></td>
                <td>
                    <span class="badge" style="background-color: ${badgeColor};">${s.score}%</span>
                </td>
                <td>
                    <span class="badge" style="background-color: ${badgeColor};">${label}</span>
                </td>
                <td>
                    <small>
                        ${riskData.reasons.map(r => `<div class="mb-1">${r}</div>`).join('')}
                    </small>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick='viewStudentRiskDetails(${JSON.stringify(s)})'>
                        <i class="bi bi-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// POPULATE ENGAGEMENT PAGE
// ============================================
function populateEngagementPage(data) {
    if (!data || !data.scores) return;

    // Calculate engagement for all students
    renderStudentEngagement(data, currentModuleCode);

    // Copy engagement data to page
    if (window.allStudentEngagement) {
        window.engagementPageStudents = window.allStudentEngagement;

        // Update count
        document.getElementById('engagementPageCount').textContent =
            `${window.allStudentEngagement.length} Students`;

        // Show all by default
        filterEngagementPage('all');
    }

    // Copy main participation charts
    copyChartToEngagementPage(data);

    // ======================================================
    // 🔥 FIX: MATERIAL ACCESS CHART FOR ENGAGEMENT PAGE
    // ======================================================

    if (data.materialUsage && Array.isArray(data.materialUsage.labels)) {
        const ctx = document.getElementById('engagementPageMaterialChart');

        // Destroy old chart (if exists)
        if (window.engagementPageMaterialChart) {
            window.engagementPageMaterialChart.destroy();
        }

        window.engagementPageMaterialChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.materialUsage.labels,
                datasets: [{
                    label: 'Material Access Count',
                    data: data.materialUsage.values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}


// Filter engagement page
function filterEngagementPage(level) {
    if (!window.engagementPageStudents) return;

    // Update button states
    ['engPageAll', 'engPageHigh', 'engPageMedium', 'engPageLow'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`engPage${level.charAt(0).toUpperCase() + level.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Filter students
    let filtered = window.engagementPageStudents;
    if (level !== 'all') {
        filtered = window.engagementPageStudents.filter(s =>
            s.level.toLowerCase() === level
        );
    }

    // Sort by engagement (low to high)
    filtered.sort((a, b) => a.avgClicks - b.avgClicks);

    // Render table
    renderEngagementPageTable(filtered);
}

// Render engagement page table
function renderEngagementPageTable(students) {
    const tbody = document.getElementById('engagementPageTable');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-5">
                    <i class="bi bi-info-circle fs-1 d-block mb-3"></i>
                    <p>No students in this category</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr style="background-color: ${s.bg};">
            <td><strong>${s.id}</strong></td>
            <td>${Math.floor(s.avgClicks)}</td>
            <td>
                <span class="badge" style="background-color: ${s.color};">
                    ${s.level}
                </span>
            </td>
            <td>${s.lastActive}</td>
            <td>
                <small class="text-muted">
                    Score: ${s.score}% | 
                    ${s.avgClicks >= 20 ? 'Active learner' :
            s.avgClicks >= 10 ? 'Moderate engagement' :
                'Needs attention'}
                </small>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick='viewStudentEngagementDetails(${JSON.stringify(s)})'>
                    <i class="bi bi-eye"></i> View Details
                </button>
            </td>
        </tr>
    `).join('');
}

// Copy charts to engagement page
// Copy charts to engagement page
function copyChartToEngagementPage(data) {
    // Copy participation chart
    if (data.trends) {
        setTimeout(() => {
            const ctx = document.getElementById('engagementPageChart');
            if (ctx && participationChartInstance) {
                new Chart(ctx, participationChartInstance.config);
            }
        }, 500);
    }

    // Copy material usage chart
    setTimeout(() => {
        const materialCtx = document.getElementById('engagementPageMaterialChart');
        if (materialCtx && materialUsageChartInstance) {
            new Chart(materialCtx, materialUsageChartInstance.config);
        }
    }, 600);

    // Copy time analysis
    const timeContainer = document.getElementById('engagementPageTimeAnalysis');
    if (timeContainer) {
        timeContainer.innerHTML = document.getElementById('timeAnalysis').innerHTML;
    }
}

// ============================================
// PERFORMANCE PAGE
// ============================================
function showPerformancePage() {
    // Hide main dashboard content
    document.getElementById('dashboardOverview').style.display = 'none';
    const mainPageHeader = document.querySelector('.content > .page-header');
    if (mainPageHeader) mainPageHeader.style.display = 'none';
    const moduleSelector = document.querySelector('.module-selector');
    if (moduleSelector) moduleSelector.style.display = 'none';
    const mainRowContent = document.querySelectorAll('.content > .row');
    mainRowContent.forEach(row => row.style.display = 'none');

    // Show performance page
    document.getElementById('performancePage').style.display = 'block';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Populate the page with data
    if (window.currentLecturerData) {
        populatePerformancePage(window.currentLecturerData);
    }
}

function populatePerformancePage(data) {
    if (!data || !data.scores) return;

    const scores = data.scores.map(s => Number(s.score));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Update average badge
    document.getElementById('performancePageAvg').textContent = avgScore.toFixed(1) + '%';

    // Calculate distribution
    const distinction = scores.filter(s => s >= 80).length;
    const merit = scores.filter(s => s >= 60 && s < 80).length;
    const pass = scores.filter(s => s >= 40 && s < 60).length;
    const fail = scores.filter(s => s < 40).length;

    document.getElementById('perfPageDistinction').textContent = distinction;
    document.getElementById('perfPageMerit').textContent = merit;
    document.getElementById('perfPagePass').textContent = pass;
    document.getElementById('perfPageFail').textContent = fail;

    // Get top performers
    const topPerformers = [...data.scores]
        .filter(s => Number(s.score) >= 70)
        .sort((a, b) => b.score - a.score);

    // Render top performers table
    renderPerformanceTopTable(topPerformers);

    // Create performance chart
    createPerformanceChart(distinction, merit, pass, fail);

    // Generate insights
    generatePerformanceInsights(data, avgScore, fail, scores.length);
}

function renderPerformanceTopTable(students) {
    const tbody = document.getElementById('perfPageTopTable');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    <i class="bi bi-info-circle fs-1 d-block mb-3"></i>
                    <p>No students scoring 70% or above</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map((s, idx) => {
        const score = Number(s.score);
        let grade, bgColor, badgeColor;

        if (score >= 80) {
            grade = 'Distinction';
            bgColor = '#d1e7dd';
            badgeColor = '#198754';
        } else if (score >= 60) {
            grade = 'Merit';
            bgColor = '#cfe2ff';
            badgeColor = '#0d6efd';
        } else {
            grade = 'Pass';
            bgColor = '#fff3cd';
            badgeColor = '#ffc107';
        }

        return `
            <tr style="background-color: ${bgColor};">
                <td><strong>#${idx + 1}</strong></td>
                <td><strong>${s.id_student}</strong></td>
                <td>
                    <span class="badge" style="background-color: ${badgeColor};">${s.score}%</span>
                </td>
                <td>${grade}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick='viewStudentPerformanceDetails(${JSON.stringify(s)})'>
                        <i class="bi bi-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function createPerformanceChart(distinction, merit, pass, fail) {
    const ctx = document.getElementById('performancePageChart');
    if (!ctx) return;

    // Destroy existing chart
    if (window.performancePageChartInstance) {
        window.performancePageChartInstance.destroy();
    }

    window.performancePageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Distinction', 'Merit', 'Pass', 'Fail'],
            datasets: [{
                data: [distinction, merit, pass, fail],
                backgroundColor: ['#198754', '#0d6efd', '#ffc107', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function generatePerformanceInsights(data, avgScore, failCount, totalStudents) {
    const container = document.getElementById('performancePageInsights');
    if (!container) return;

    const failRate = (failCount / totalStudents * 100).toFixed(0);

    let insights = '';

    if (avgScore >= 70) {
        insights = `
            <div class="alert alert-success">
                <h5><i class="bi bi-check-circle-fill me-2"></i>Excellent Class Performance!</h5>
                <p class="mb-2">The class average of ${avgScore.toFixed(1)}% indicates strong understanding of ${currentModuleCode} content.</p>
                <ul class="mb-0">
                    <li>Continue with current teaching methods</li>
                    <li>Consider offering advanced enrichment materials</li>
                    <li>Encourage peer tutoring opportunities</li>
                </ul>
            </div>
        `;
    } else if (failRate > 20) {
        insights = `
            <div class="alert alert-danger">
                <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>High Failure Rate Detected</h5>
                <p class="mb-2">${failRate}% of students are failing ${currentModuleCode}. Immediate intervention required.</p>
                <ul class="mb-0">
                    <li>Schedule review sessions for core concepts</li>
                    <li>Provide additional practice materials</li>
                    <li>Consider adjusting assessment difficulty</li>
                    <li>Implement peer mentoring program</li>
                </ul>
            </div>
        `;
    } else {
        insights = `
            <div class="alert alert-info">
                <h5><i class="bi bi-info-circle-fill me-2"></i>Moderate Performance</h5>
                <p class="mb-2">Class average of ${avgScore.toFixed(1)}% shows room for improvement in ${currentModuleCode}.</p>
                <ul class="mb-0">
                    <li>Identify struggling students early</li>
                    <li>Offer additional support sessions</li>
                    <li>Review difficult topics in tutorials</li>
                </ul>
            </div>
        `;
    }

    container.innerHTML = insights;
}

// ============================================
// LEVEL 3: INDIVIDUAL STUDENT DETAIL MODALS
// ============================================

// View at-risk student details
function viewStudentRiskDetails(student) {
    if (!window.currentLecturerData) {
        alert('Data not available');
        return;
    }

    const score = Number(student.score);
    const isCritical = score < 30;
    const riskData = calculateRiskReasons(student, window.currentLecturerData);

    const badgeColor = isCritical ? '#dc3545' : '#e85d75';  // Medium red
    const badgeLabel = isCritical ? 'CRITICAL' : 'MODERATE';
    const bgColor = isCritical ? '#f8d7da' : '#ffd6d9';  // Light red

    const modalContent = `
        <div class="alert" style="background-color: ${bgColor}; border-color: ${badgeColor}; color: ${badgeColor};">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h4 class="mb-1">
                        <i class="bi bi-person-fill me-2"></i>
                        Student: <strong>${student.id_student}</strong>
                    </h4>
                    <p class="mb-0">Module: <strong>${currentModuleCode}</strong></p>
                </div>
                <span class="badge fs-5" style="background-color: ${badgeColor};">${badgeLabel}</span>
            </div>
        </div>
        
        <div class="row g-3 mb-4">
            <div class="col-md-4">
                <div class="card text-center" style="background-color: ${bgColor}; border-color: ${badgeColor};">
                    <div class="card-body">
                        <i class="bi bi-clipboard-data fs-1 mb-2" style="color: ${badgeColor};"></i>
                        <h2 class="mb-0" style="color: ${badgeColor};">${score}%</h2>
                        <small class="text-muted">Current Score</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center border-warning">
                    <div class="card-body">
                        <i class="bi bi-x-circle fs-1 text-warning mb-2"></i>
                        <h2 class="mb-0">${riskData.missingTasks}</h2>
                        <small class="text-muted">Missing Tasks</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center border-info">
                    <div class="card-body">
                        <i class="bi bi-mouse fs-1 text-info mb-2"></i>
                        <h2 class="mb-0">${riskData.vleClicks}</h2>
                        <small class="text-muted">VLE Clicks</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card border-danger mb-3">
            <div class="card-header" style="background-color: ${badgeColor}; color: white;">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Why is this student at risk?</strong>
            </div>
            <div class="card-body">
                <div class="list-group list-group-flush">
                    ${riskData.reasons.map(reason => `
                        <div class="list-group-item">
                            <i class="bi bi-dot"></i> ${reason}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="card border-success">
            <div class="card-header bg-success text-white">
                <i class="bi bi-lightbulb-fill me-2"></i>
                <strong>Recommended Actions</strong>
            </div>
            <div class="card-body">
                <ul class="mb-3">
                    ${isCritical ? `
                        <li><strong>Urgent:</strong> Schedule 1-on-1 consultation within 48 hours</li>
                        <li>Send personalized email with support resources</li>
                        <li>Refer to academic support services</li>
                        <li>Set up weekly check-ins until improvement shown</li>
                    ` : `
                        <li>Send reminder email about missing assessments</li>
                        <li>Encourage attendance at tutorial sessions</li>
                        <li>Provide additional practice materials</li>
                        <li>Monitor progress weekly</li>
                    `}
                </ul>
                
                <div class="d-grid gap-2 d-md-flex">
                    <button class="btn btn-primary flex-fill" onclick="sendEmailToStudent('${student.id_student}', 'support')">
                        <i class="bi bi-envelope-fill me-2"></i>
                        Send Support Email
                    </button>
                    <button class="btn btn-success flex-fill" onclick="scheduleMeetingWithStudent('${student.id_student}')">
                        <i class="bi bi-calendar-check me-2"></i>
                        Schedule Meeting
                    </button>
                </div>
            </div>
        </div>
    `;

    const modal = createDrillDownModal(
        `At-Risk Student Analysis: ${student.id_student}`,
        modalContent
    );

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// View engagement student details
function viewStudentEngagementDetails(student) {
    const engagementColor = student.level === 'High' ? '#198754' :
        student.level === 'Medium' ? '#ffc107' : '#dc3545';

    const modalContent = `
        <div class="alert" style="background-color: ${student.bg}; border-color: ${engagementColor};">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h4 class="mb-1">
                        <i class="bi bi-person-fill me-2"></i>
                        Student: <strong>${student.id}</strong>
                    </h4>
                    <p class="mb-0">Module: <strong>${currentModuleCode}</strong></p>
                </div>
                <span class="badge fs-5" style="background-color: ${engagementColor};">
                    ${student.level} Engagement
                </span>
            </div>
        </div>
        
        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="card text-center border-primary">
                    <div class="card-body">
                        <i class="bi bi-mouse fs-1 text-primary mb-2"></i>
                        <h2 class="mb-0">${Math.floor(student.avgClicks)}</h2>
                        <small class="text-muted">Avg Clicks/Day</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center border-success">
                    <div class="card-body">
                        <i class="bi bi-clipboard-data fs-1 text-success mb-2"></i>
                        <h2 class="mb-0">${student.score}%</h2>
                        <small class="text-muted">Current Score</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center" style="border-color: ${engagementColor};">
                    <div class="card-body">
                        <i class="bi bi-graph-up fs-1 mb-2" style="color: ${engagementColor};"></i>
                        <h3 class="mb-0">${student.level}</h3>
                        <small class="text-muted">Engagement</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-center border-info">
                    <div class="card-body">
                        <i class="bi bi-clock-history fs-1 text-info mb-2"></i>
                        <h5 class="mb-0">${student.lastActive}</h5>
                        <small class="text-muted">Last Active</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card border-info mb-3">
            <div class="card-header bg-info text-white">
                <i class="bi bi-info-circle-fill me-2"></i>
                <strong>Activity Summary</strong>
            </div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-6">
                        <h6>VLE Activity Pattern</h6>
                        <div class="progress mb-2" style="height: 25px;">
                            <div class="progress-bar" style="width: ${(student.avgClicks / 30 * 100).toFixed(0)}%; background-color: ${engagementColor};">
                                ${Math.floor(student.avgClicks)} clicks/day
                            </div>
                        </div>
                        <small class="text-muted">
                            ${student.avgClicks >= 20 ? '✅ Above average engagement' :
            student.avgClicks >= 10 ? '⚠️ Moderate engagement' :
                '❌ Below average engagement'}
                        </small>
                    </div>
                    <div class="col-md-6">
                        <h6>Academic Performance</h6>
                        <div class="progress mb-2" style="height: 25px;">
                            <div class="progress-bar ${student.score >= 70 ? 'bg-success' : student.score >= 40 ? 'bg-warning' : 'bg-danger'}" 
                                 style="width: ${student.score}%;">
                                ${student.score}%
                            </div>
                        </div>
                        <small class="text-muted">
                            ${student.score >= 70 ? '✅ Strong performance' :
            student.score >= 40 ? '⚠️ Passing' :
                '❌ At risk of failing'}
                        </small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card border-${student.level === 'Low' ? 'danger' : 'success'}">
            <div class="card-header bg-${student.level === 'Low' ? 'danger' : 'success'} text-white">
                <i class="bi bi-lightbulb-fill me-2"></i>
                <strong>Recommended Actions</strong>
            </div>
            <div class="card-body">
                <ul class="mb-3">
                    ${student.level === 'Low' ? `
                        <li><strong>Priority:</strong> Contact student about low engagement</li>
                        <li>Send reminder to access course materials</li>
                        <li>Encourage participation in discussion forums</li>
                        <li>Check for technical or personal barriers</li>
                    ` : student.level === 'Medium' ? `
                        <li>Send encouragement message</li>
                        <li>Highlight upcoming deadlines</li>
                        <li>Suggest additional resources</li>
                    ` : `
                        <li>Commend high engagement</li>
                        <li>Consider as peer mentor candidate</li>
                        <li>Offer advanced materials</li>
                    `}
                </ul>
                
                <div class="d-grid gap-2 d-md-flex">
                    <button class="btn btn-primary flex-fill" onclick="sendEmailToStudent('${student.id}', 'engagement')">
                        <i class="bi bi-envelope-fill me-2"></i>
                        Send Email
                    </button>
                    <button class="btn btn-success flex-fill" onclick="scheduleMeetingWithStudent('${student.id}')">
                        <i class="bi bi-calendar-check me-2"></i>
                        Schedule Meeting
                    </button>
                </div>
            </div>
        </div>
    `;

    const modal = createDrillDownModal(
        `Student Engagement Analysis: ${student.id}`,
        modalContent
    );

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// View performance student details
function viewStudentPerformanceDetails(student) {
    const score = Number(student.score);
    let grade, gradeColor, gradeBg;

    if (score >= 80) {
        grade = 'Distinction';
        gradeColor = '#198754';
        gradeBg = '#d1e7dd';
    } else if (score >= 60) {
        grade = 'Merit';
        gradeColor = '#0d6efd';
        gradeBg = '#cfe2ff';
    } else {
        grade = 'Pass';
        gradeColor = '#ffc107';
        gradeBg = '#fff3cd';
    }

    const modalContent = `
        <div class="alert" style="background-color: ${gradeBg}; border-color: ${gradeColor};">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h4 class="mb-1">
                        <i class="bi bi-person-fill me-2"></i>
                        Student: <strong>${student.id_student}</strong>
                    </h4>
                    <p class="mb-0">Module: <strong>${currentModuleCode}</strong></p>
                </div>
                <span class="badge fs-5" style="background-color: ${gradeColor};">${grade}</span>
            </div>
        </div>
        
        <div class="row g-3 mb-4">
            <div class="col-md-4">
                <div class="card text-center" style="background-color: ${gradeBg}; border-color: ${gradeColor};">
                    <div class="card-body">
                        <i class="bi bi-trophy-fill fs-1 mb-2" style="color: ${gradeColor};"></i>
                        <h1 class="mb-0" style="color: ${gradeColor};">${score}%</h1>
                        <small class="text-muted">Final Score</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center border-primary">
                    <div class="card-body">
                        <i class="bi bi-award-fill fs-1 text-primary mb-2"></i>
                        <h2 class="mb-0">${grade}</h2>
                        <small class="text-muted">Grade</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center border-success">
                    <div class="card-body">
                        <i class="bi bi-check-circle-fill fs-1 text-success mb-2"></i>
                        <h2 class="mb-0">5/5</h2>
                        <small class="text-muted">Completed</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card border-success mb-3">
            <div class="card-header bg-success text-white">
                <i class="bi bi-graph-up-arrow me-2"></i>
                <strong>Strengths & Achievements</strong>
            </div>
            <div class="card-body">
                <ul class="mb-0">
                    <li>Consistently high performance across all assessments</li>
                    <li>Strong understanding of core concepts</li>
                    <li>Active participation in course activities</li>
                    <li>Excellent time management</li>
                </ul>
            </div>
        </div>
        
        <div class="card border-info">
            <div class="card-header bg-info text-white">
                <i class="bi bi-lightbulb-fill me-2"></i>
                <strong>Recognition & Next Steps</strong>
            </div>
            <div class="card-body">
                <ul class="mb-3">
                    <li>Commend excellent performance</li>
                    <li>Consider as peer mentor for struggling students</li>
                    <li>Offer advanced enrichment materials</li>
                    <li>Recommend for academic awards/scholarships</li>
                </ul>
                
                <div class="d-grid gap-2 d-md-flex">
                    <button class="btn btn-success flex-fill" onclick="sendEmailToStudent('${student.id_student}', 'congratulations')">
                        <i class="bi bi-envelope-fill me-2"></i>
                        Send Congratulations
                    </button>
                    <button class="btn btn-primary flex-fill" onclick="scheduleMeetingWithStudent('${student.id_student}')">
                        <i class="bi bi-calendar-check me-2"></i>
                        Schedule Meeting
                    </button>
                </div>
            </div>
        </div>
    `;

    const modal = createDrillDownModal(
        `High Performer Analysis: ${student.id_student}`,
        modalContent
    );

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// ============================================
// ACTION BUTTONS (Send Email & Schedule Meeting)
// ============================================

// Send email to student
function sendEmailToStudent(studentId, emailType) {
    let subject = '';
    let body = '';
    const lecturerName = 'Dr. Lecturer'; // Change this to actual lecturer name
    const moduleCode = currentModuleCode || 'Your Module';

    // Generate email content based on type
    switch (emailType) {
        case 'support':
            subject = `Academic Support Available - ${moduleCode}`;
            body = `Dear Student ${studentId},

I hope this email finds you well. I'm reaching out because I've noticed you may be experiencing some challenges in ${moduleCode}.

I want to assure you that support is available, and I'm here to help you succeed. I'd like to discuss:

- Your current progress and any difficulties you're facing
- Strategies to improve your understanding of the material
- Available resources and support services
- A plan to get you back on track

Please reply to this email or schedule a meeting with me at your earliest convenience. Remember, asking for help is a sign of strength, not weakness.

I'm confident that with the right support, you can improve your performance in this module.

Best regards,
${lecturerName}
Module: ${moduleCode}`;
            break;

        case 'engagement':
            subject = `We Miss You in ${moduleCode}!`;
            body = `Dear Student ${studentId},

I've noticed that your engagement with ${moduleCode} materials has been lower than usual, and I wanted to check in with you.

Regular interaction with course materials is crucial for success, and I want to make sure you have everything you need to stay on track.

Are you experiencing any challenges? Is there anything I can do to support your learning?

Please let me know if you'd like to discuss this further. I'm here to help!

Best regards,
${lecturerName}
Module: ${moduleCode}`;
            break;

        case 'congratulations':
            subject = `Excellent Performance in ${moduleCode}!`;
            body = `Dear Student ${studentId},

I wanted to take a moment to congratulate you on your outstanding performance in ${moduleCode}!

Your hard work, dedication, and excellent understanding of the material have not gone unnoticed. You're setting a great example for your peers.

I'd like to discuss some exciting opportunities with you:
- Potential peer mentoring roles
- Advanced enrichment materials
- Recommendations for academic awards

Keep up the fantastic work!

Best regards,
${lecturerName}
Module: ${moduleCode}`;
            break;

        default:
            subject = `Regarding ${moduleCode}`;
            body = `Dear Student ${studentId},

I would like to discuss your progress in ${moduleCode}.

Please let me know when you're available for a conversation.

Best regards,
${lecturerName}`;
    }

    // Create mailto link
    const mailto = `mailto:student${studentId}@university.edu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open email client
    window.location.href = mailto;

    // Show confirmation
    showNotification('Email client opened', 'The email template has been prepared. You can edit it before sending.', 'success');
}

// Schedule meeting with student
function scheduleMeetingWithStudent(studentId) {
    const moduleCode = currentModuleCode || 'Module';
    const lecturerName = 'Dr. Lecturer'; // Change this to actual lecturer name

    // Generate calendar event details
    const title = `Meeting with Student ${studentId} - ${moduleCode}`;
    const description = `Academic consultation meeting for ${moduleCode}.

Student ID: ${studentId}
Lecturer: ${lecturerName}

Topics to discuss:
- Current progress and performance
- Challenges and support needed
- Action plan for improvement

Please come prepared with questions and materials.`;

    // Set default meeting time (tomorrow at 2 PM)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(14, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(15, 0, 0, 0);

    // Format dates for calendar (YYYYMMDDTHHMMSS format)
    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    // Create Google Calendar link
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(title)}` +
        `&details=${encodeURIComponent(description)}` +
        `&dates=${formatDate(startDate)}/${formatDate(endDate)}` +
        `&add=student${studentId}@university.edu`;

    // Create iCal/Outlook format (.ics file)
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lecturer Dashboard//Meeting Scheduler//EN
BEGIN:VEVENT
UID:${Date.now()}@lecturerdashboard.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:Lecturer Office / Online
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    // Show modal with options
    const modalContent = `
        <div class="alert alert-info">
            <i class="bi bi-calendar-check me-2"></i>
            <strong>Schedule Meeting with Student ${studentId}</strong>
        </div>
        
        <div class="card mb-3">
            <div class="card-body">
                <h6 class="card-title">Meeting Details</h6>
                <p class="mb-2"><strong>Student:</strong> ${studentId}</p>
                <p class="mb-2"><strong>Module:</strong> ${moduleCode}</p>
                <p class="mb-2"><strong>Proposed Time:</strong> ${startDate.toLocaleString()}</p>
                <p class="mb-0"><strong>Duration:</strong> 1 hour</p>
            </div>
        </div>
        
        <div class="alert alert-warning">
            <i class="bi bi-info-circle me-2"></i>
            <small>Choose your preferred calendar application below. You can adjust the date and time before saving.</small>
        </div>
        
        <div class="d-grid gap-2">
            <a href="${googleCalendarUrl}" target="_blank" class="btn btn-primary btn-lg">
                <i class="bi bi-google me-2"></i>
                Add to Google Calendar
            </a>
            
            <button class="btn btn-success btn-lg" onclick="downloadICS('${studentId}', \`${icsContent.replace(/`/g, '\\`')}\`)">
                <i class="bi bi-calendar-event me-2"></i>
                Download iCal/Outlook Event
            </button>
            
            <button class="btn btn-info btn-lg" onclick="copyMeetingDetails('${studentId}', '${startDate.toLocaleString()}')">
                <i class="bi bi-clipboard me-2"></i>
                Copy Meeting Details
            </button>
        </div>
    `;

    const modal = createDrillDownModal(
        `Schedule Meeting: ${studentId}`,
        modalContent
    );

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// Download ICS file
function downloadICS(studentId, icsContent) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meeting_${studentId}_${Date.now()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Calendar Event Downloaded', 'The meeting invitation has been downloaded. You can import it into your calendar application.', 'success');
}

// Copy meeting details to clipboard
function copyMeetingDetails(studentId, dateTime) {
    const text = `Meeting with Student ${studentId}
Module: ${currentModuleCode}
Date/Time: ${dateTime}
Duration: 1 hour
Location: Lecturer Office / Online

Please confirm your availability.`;

    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied!', 'Meeting details copied to clipboard. You can paste them in an email or messaging app.', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Copied!', 'Meeting details copied to clipboard.', 'success');
    });
}

// Show notification (toast)
function showNotification(title, message, type = 'info') {
    const colors = {
        success: '#198754',
        info: '#0d6efd',
        warning: '#ffc107',
        danger: '#dc3545'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-left: 4px solid ${colors[type]};
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 9999;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: start; gap: 0.75rem;">
            <i class="bi bi-check-circle-fill" style="color: ${colors[type]}; font-size: 1.5rem;"></i>
            <div style="flex: 1;">
                <strong style="display: block; margin-bottom: 0.25rem;">${title}</strong>
                <small style="color: #6c757d;">${message}</small>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6c757d;">×</button>
        </div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions globally available
window.drillDownTotalStudents = drillDownTotalStudents;
window.drillDownClassScore = drillDownClassScore;
window.drillDownTopPerformers = drillDownTopPerformers;
window.drillDownAtRisk = drillDownAtRisk;
window.filterRiskLevel = filterRiskLevel;
window.sortRiskTable = sortRiskTable;
window.exportModuleToExcel = exportModuleToExcel;
window.exportAttendanceReport = exportAttendanceReport;
window.viewTeachingLog = viewTeachingLog;
window.viewHighRiskStudents = viewHighRiskStudents;
window.loadLecturerData = loadLecturerData;
window.showAtRiskPage = showAtRiskPage;
window.showEngagementPage = showEngagementPage;
window.backToDashboard = backToDashboard;
window.filterRiskPageLevel = filterRiskPageLevel;
window.filterEngagementPage = filterEngagementPage;
window.showPerformancePage = showPerformancePage;
window.viewStudentRiskDetails = viewStudentRiskDetails;
window.viewStudentEngagementDetails = viewStudentEngagementDetails;
window.viewStudentPerformanceDetails = viewStudentPerformanceDetails;
window.sendEmailToStudent = sendEmailToStudent;
window.scheduleMeetingWithStudent = scheduleMeetingWithStudent;
window.downloadICS = downloadICS;
window.copyMeetingDetails = copyMeetingDetails;
window.showNotification = showNotification;
