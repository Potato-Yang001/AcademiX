// ============================================
// ADMIN DASHBOARD - IMPROVED WITH 4C PRINCIPLES
// ============================================
let allStudentsData = [];
let allSubjectsData = [];
let currentPage = 1;
const studentsPerPage = 10;

let coursesData = [];

// Add this function to load courses.csv
async function loadCoursesData() {
    try {
        console.log('📚 Loading courses.csv...');
        const response = await fetch('courses.csv');

        if (!response.ok) {
            console.error('❌ Failed to fetch courses.csv:', response.status, response.statusText);
            return [];
        }

        const csvText = await response.text();
        console.log('✅ CSV loaded, length:', csvText.length);

        // Parse CSV - handle different line endings
        const lines = csvText.split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim());
        console.log('📋 Headers:', headers);

        coursesData = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = line.split(',').map(v => v.trim());
                return {
                    code_module: values[0],
                    code_presentation: values[1],
                    length: values[2] // ✅ This is the duration column
                };
            })
            .filter(course => course.code_module && course.code_presentation && course.length);

        console.log(`✅ Loaded ${coursesData.length} courses`);
        console.log('📊 Sample course:', coursesData[0]);
        return coursesData;
    } catch (error) {
        console.error("❌ Error loading courses.csv:", error);
        return [];
    }
}

function updateInsightCards(courseData) {
    console.log('🔍 === STARTING INSIGHT CARD ANALYSIS ===');
    console.log('Total courses received:', courseData.length);

    const highWithdrawalList = [];
    const highEngagementList = [];
    const atRiskList = [];
    const othersList = [];

    courseData.forEach(c => {
        if (c.withdrawalRate >= 30) {
            highWithdrawalList.push(c);
            console.log(`  🚨 HIGH WITHDRAWAL: ${c.module}-${c.presentation} = ${c.withdrawalRate}%`);
        }
        else if (c.passRate >= 70 && c.withdrawalRate < 20 && c.avgScore >= 70) {
            highEngagementList.push(c);
            console.log(`  🌟 HIGH ENGAGEMENT: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Withdrawal:${c.withdrawalRate}%, Score:${c.avgScore}`);
        }
        else if (c.withdrawalRate < 30 && (c.passRate < 50 || c.avgScore < 55 || c.withdrawalRate >= 20)) {
            atRiskList.push(c);
            console.log(`  ⚠️ NEEDS ATTENTION: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Score:${c.avgScore}, Withdrawal:${c.withdrawalRate}%`);
        }
        else {
            othersList.push(c);
            console.log(`  ✅ PERFORMING WELL: ${c.module}-${c.presentation} - Pass:${c.passRate}%, Score:${c.avgScore}, Withdrawal:${c.withdrawalRate}%`);
        }
    });

    const highWithdrawalCount = highWithdrawalList.length;
    const highEngagementCount = highEngagementList.length;
    const atRiskCount = atRiskList.length;
    const othersCount = othersList.length;

    console.log(`📊 === FINAL COUNTS ===`);
    console.log(`   High Withdrawal: ${highWithdrawalCount}`);
    console.log(`   High Engagement: ${highEngagementCount}`);
    console.log(`   Needs Attention: ${atRiskCount}`);
    console.log(`   Performing Well: ${othersCount}`);
    console.log(`   TOTAL: ${courseData.length}`);

    const calculatedTotal = highWithdrawalCount + highEngagementCount + atRiskCount + othersCount;
    if (calculatedTotal !== courseData.length) {
        console.error(`❌ MISMATCH! Calculated: ${calculatedTotal}, Expected: ${courseData.length}`);
    }

    // Update all 4 cards
    const highWithdrawalCard = document.getElementById('highWithdrawalCoursesCard');
    const highEngagementCard = document.getElementById('highEngagementCoursesCard');
    const atRiskCard = document.getElementById('atRiskCoursesCard');
    const performingWellCard = document.getElementById('performingWellCoursesCard');

    if (highWithdrawalCard) highWithdrawalCard.textContent = highWithdrawalCount;
    if (highEngagementCard) highEngagementCard.textContent = highEngagementCount;
    if (atRiskCard) atRiskCard.textContent = atRiskCount;
    if (performingWellCard) performingWellCard.textContent = othersCount;

    console.log('🔍 === INSIGHT CARD ANALYSIS COMPLETE ===');
}

async function loadAdminData() {
    try {
        // ✅ CRITICAL: Load courses data FIRST and WAIT for it
        coursesData = await loadCoursesData();
        console.log('📊 Courses loaded:', coursesData.length, 'courses');

        if (coursesData.length === 0) {
            console.error('❌ CRITICAL: No courses data loaded! Check courses.csv path');
        }

        const res = await fetch("/api/admin");
        const data = await res.json();
        console.log('📡 Admin API data received');

        if (!data.subjects && data.enrolments) {
            console.log('🔧 Generating subjects from enrollments with courses data...');
            allSubjectsData = generateSubjectsFromEnrolments(data.enrolments, coursesData);
            console.log('✅ Generated subjects:', allSubjectsData.length);
            console.log('📋 Sample subject:', allSubjectsData[0]);
        } else {
            allSubjectsData = data.subjects || [];
        }

        const outcomes = data.outcomes || {};
        const totalStudents = Object.values(outcomes).reduce((a, b) => a + b, 0);

        if (!data.students) {
            allStudentsData = generateAllStudents(outcomes);
        } else {
            allStudentsData = data.students;
        }

        const atRiskData = calculateAtRiskMetrics(data, allStudentsData);

        // ✅ GENERATE courseData ONCE with CONSISTENT random values
        const enrolments = data.enrolments || {};
        const courseData = Object.entries(enrolments).map(([course, count]) => {
            let parts = course.includes('_') ? course.split('_') : course.split('-');
            const module = parts[0] || 'Unknown';
            const presentation = parts[1] || 'Unknown';

            // Generate CONSISTENT percentages that add up to 100%
            const withdrawalRate = Math.floor(Math.random() * 36) + 5; // 5-40%
            const remaining = 100 - withdrawalRate;
            const passOfRemaining = Math.floor(Math.random() * 46) + 40; // 40-85%
            let passRate = Math.floor((remaining * passOfRemaining) / 100);
            let failRate = remaining - passRate;

            // Ensure they add up to exactly 100%
            const total = passRate + failRate + withdrawalRate;
            if (total !== 100) {
                passRate += (100 - total); // Adjust pass rate to make it exactly 100%
            }

            const avgScore = Math.floor(40 + (passRate * 0.8));

            return {
                module,
                presentation,
                enrollments: count,
                avgScore,
                passRate: parseFloat(passRate.toFixed(1)),
                failRate: parseFloat(failRate.toFixed(1)),
                withdrawalRate: parseFloat(withdrawalRate.toFixed(1))
            };
        });

        // ✅ Store courseData globally so it's consistent everywhere
        window.globalCourseData = courseData;

        // Render all sections with THE SAME courseData
        renderAdminSummary(data);
        renderAtRiskAlerts(atRiskData);
        updateInsightCards(courseData); // ✅ Use the same courseData
        renderEnrolmentChart(data.enrolments);
        renderOutcomeChart(data.outcomes);
        renderCoursePerformanceTable(data, courseData); // ✅ Pass the same courseData
        renderCapacityTable(allSubjectsData);
        renderSubjectsTable(allSubjectsData);
        renderDemandTable(allSubjectsData);
        renderGenderChart(data.gender);
        renderAgeChart(data.age);

        setupAdminFilters();
    } catch (error) {
        console.error("Error loading admin data:", error);
    }
}

// Toggle course details visibility
function toggleCourseDetails() {
    const insightsSection = document.getElementById('courseInsightsSection');
    const capacitySection = document.getElementById('capacity');
    const demandSection = document.getElementById('demand');

    // Toggle visibility
    if (insightsSection.style.display === 'none') {
        // Show sections with smooth animation
        insightsSection.style.display = 'block';
        capacitySection.style.display = 'block';
        demandSection.style.display = 'block';

        // Smooth scroll to insights
        setTimeout(() => {
            insightsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        console.log('✅ Course details sections shown');
    } else {
        // Hide sections
        insightsSection.style.display = 'none';
        capacitySection.style.display = 'none';
        demandSection.style.display = 'none';

        console.log('❌ Course details sections hidden');
    }
}

// Generate ALL students (not just 100)
function generateAllStudents(outcomes) {
    const students = [];
    let studentId = 10000;

    const outcomeTypes = [
        { type: 'Pass', count: outcomes.Pass || 0 },
        { type: 'Fail', count: outcomes.Fail || 0 },
        { type: 'Distinction', count: outcomes.Distinction || 0 },
        { type: 'Withdrawn', count: outcomes.Withdrawn || 0 }
    ];

    outcomeTypes.forEach(outcome => {
        for (let i = 0; i < outcome.count; i++) {
            students.push({
                id_student: String(studentId++),
                modules_enrolled: 'Various',
                studied_credits: Math.floor(Math.random() * 120) + 30,
                final_result: outcome.type
            });
        }
    });

    return students;
}

// Calculate at-risk metrics
function calculateAtRiskMetrics(data, students) {
    const outcomes = data.outcomes || {};
    const enrolments = data.enrolments || {};

    // Students with low scores (estimate: 64% of failing students)
    const lowScoreStudents = Math.floor((outcomes.Fail || 0) * 0.64);

    // Courses with high withdrawal rates (>30%)
    const totalEnrolments = Object.values(enrolments).reduce((a, b) => a + b, 0);
    const withdrawalRate = (outcomes.Withdrawn || 0) / totalEnrolments;
    const highWithdrawalCourses = Object.entries(enrolments).filter(([course, count]) => {
        return withdrawalRate > 0.3;
    }).length;

    // Low engagement students (estimate: 15% of total)
    const lowEngagementStudents = Math.floor(students.length * 0.15);

    return {
        lowScoreStudents,
        highWithdrawalCourses: Math.max(highWithdrawalCourses, Math.ceil(Object.keys(enrolments).length * 0.25)),
        lowEngagementStudents
    };
}

// Render at-risk alerts
function renderAtRiskAlerts(atRiskData) {
    const lowScoreEl = document.getElementById('lowScoreCount');
    const highWithdrawalEl = document.getElementById('highWithdrawalCount');
    const lowEngagementEl = document.getElementById('lowEngagementCount');

    if (lowScoreEl) lowScoreEl.textContent = atRiskData.lowScoreStudents.toLocaleString();
    if (highWithdrawalEl) highWithdrawalEl.textContent = atRiskData.highWithdrawalCourses;
    if (lowEngagementEl) lowEngagementEl.textContent = atRiskData.lowEngagementStudents.toLocaleString();
}

// ============================================
// ENHANCED COURSE PERFORMANCE TABLE
// ============================================

function renderCoursePerformanceTable(data, courseData) {
    const tbody = document.getElementById('performanceTableBody');
    if (!tbody) return;

    // ✅ FIXED: Use EXACT SAME categorization logic with else-if
    const categorizeAndSort = (courses) => {
        return courses.map(course => {
            let category, priority;

            // Category 1: High Withdrawal (≥30%) - HIGHEST PRIORITY
            if (course.withdrawalRate >= 30) {
                category = 'high-withdrawal';
                priority = 1;
            }
            // Category 2: High Engagement - Pass ≥70%, Withdrawal <20%, Score ≥70
            else if (course.passRate >= 70 && course.withdrawalRate < 20 && course.avgScore >= 70) {
                category = 'high-engagement';
                priority = 3;
            }
            // Category 3: Needs Attention - Withdrawal <30% BUT (Pass <50% OR Score <55 OR Withdrawal ≥20%)
            else if (course.withdrawalRate < 30 && (course.passRate < 50 || course.avgScore < 55 || course.withdrawalRate >= 20)) {
                category = 'at-risk';
                priority = 2;
            }
            // Category 4: Others (Performing Well)
            else {
                category = 'performing-well';
                priority = 4;
            }

            return { ...course, category, priority };
        }).sort((a, b) => {
            // Sort by priority first, then by withdrawal rate within same category
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.withdrawalRate - a.withdrawalRate;
        });
    };

    const sortedCourseData = categorizeAndSort(courseData);

    const html = sortedCourseData.map(course => {
        const scoreClass = course.avgScore >= 70 ? 'success' :
            course.avgScore >= 60 ? 'warning' : 'danger';
        const passRateClass = course.passRate >= 70 ? 'success' :
            course.passRate >= 60 ? 'warning' : 'danger';
        const withdrawalRateClass = course.withdrawalRate >= 30 ? 'danger' :
            course.withdrawalRate >= 20 ? 'warning' : 'success';

        // ✅ EXACT SAME categorization as updateInsightCards
        let statusBadge;
        if (course.category === 'high-withdrawal') {
            statusBadge = '<span class="status-badge status-risk fs-6" data-category="high-withdrawal">🚨 High Withdrawal</span>';
        } else if (course.category === 'high-engagement') {
            statusBadge = '<span class="status-badge status-excellent fs-6" data-category="high-engagement">🌟 High Engagement</span>';
        } else if (course.category === 'at-risk') {
            statusBadge = '<span class="status-badge status-monitor fs-6" data-category="at-risk">⚠️ Needs Attention</span>';
        } else {
            // Category: performing-well (Others)
            statusBadge = '<span class="status-badge fs-6" data-category="performing-well" style="background: #e3f2fd; color: #1976d2;">✅ Performing Well</span>';
        }

        return `
            <tr>
                <td style="width: 12%;"><strong>${course.module}</strong></td>
                <td style="width: 13%;"><span class="badge bg-secondary">${course.presentation}</span></td>
                <td class="text-end" style="width: 11%;"><strong>${course.enrollments.toLocaleString()}</strong></td>
                <td class="text-end" style="width: 11%;">
                    <strong class="text-${scoreClass}">${course.avgScore}<small class="text-muted">/100</small></strong>
                </td>
                <td style="width: 20%;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="flex-grow-1">
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-${passRateClass}" style="width: ${course.passRate}%"></div>
                            </div>
                        </div>
                        <strong class="text-${passRateClass}" style="min-width: 55px; text-align: right;">${course.passRate}%</strong>
                    </div>
                    <small class="text-muted" style="font-size: 0.7rem;">
                        Pass: ${course.passRate}% | Fail: ${course.failRate}%
                    </small>
                </td>
                <td style="width: 20%;">
                    <div class="d-flex align-items-center gap-2">
                        <div class="flex-grow-1">
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar bg-${withdrawalRateClass}" style="width: ${course.withdrawalRate}%"></div>
                            </div>
                        </div>
                        <strong class="text-${withdrawalRateClass}" style="min-width: 48px; text-align: right;">${course.withdrawalRate}%</strong>
                    </div>
                </td>
                <td class="text-center" style="width: 13%;">${statusBadge}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// Scroll to section with filter highlighting
function scrollToSection(sectionId, filter) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Apply filter highlighting after scroll
        setTimeout(() => {
            highlightFilteredRows(filter);
        }, 800);
    }
}

function highlightFilteredRows(filter) {
    const tbody = document.getElementById('performanceTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        row.classList.remove('highlight-row');

        if (!row.cells || row.cells.length < 7) return;

        const statusBadge = row.cells[6].querySelector('[data-category]');
        if (!statusBadge) return;

        const category = statusBadge.getAttribute('data-category');

        if (filter === 'high-withdrawal' && category === 'high-withdrawal') {
            row.classList.add('highlight-row');
        } else if (filter === 'high-engagement' && category === 'high-engagement') {
            row.classList.add('highlight-row');
        } else if (filter === 'at-risk' && category === 'at-risk') {
            row.classList.add('highlight-row');
        } else if (filter === 'performing-well' && category === 'performing-well') {
            row.classList.add('highlight-row');
        }
    });
}

// Render capacity analysis table
function renderCapacityTable(subjects) {
    const tbody = document.getElementById('capacityTableBody');
    if (!tbody) return;

    const html = subjects.map(subject => {
        // REAL CAPACITY LOGIC: Based on typical classroom/resource limits
        // Small courses: 50 students per section
        // Medium courses: 100 students per section  
        // Large courses: 200 students per section

        let maxCapacity;
        if (subject.enrolments <= 500) {
            // Small course: 50 students/section, allow up to 10 sections = 500 max
            maxCapacity = Math.ceil(subject.enrolments / 50) * 50 + 50; // Current sections + 1 buffer section
        } else if (subject.enrolments <= 1500) {
            // Medium course: 100 students/section
            maxCapacity = Math.ceil(subject.enrolments / 100) * 100 + 100;
        } else {
            // Large course: 200 students/section
            maxCapacity = Math.ceil(subject.enrolments / 200) * 200 + 200;
        }

        const availableSeats = maxCapacity - subject.enrolments;
        const utilizationPercent = ((subject.enrolments / maxCapacity) * 100).toFixed(0);

        const needsAction = utilizationPercent >= 85;
        const actionBadge = needsAction
            ? '<span class="badge bg-danger fs-6 px-3 py-2">⚠️ Open New Section</span>'
            : utilizationPercent >= 70
                ? '<span class="badge bg-warning fs-6 px-3 py-2">📊 Monitor</span>'
                : '<span class="badge bg-success fs-6 px-3 py-2">✅ Sufficient</span>';

        const utilizationClass = utilizationPercent >= 85 ? 'danger' :
            utilizationPercent >= 70 ? 'warning' : 'success';

        return `
                <tr class="${needsAction ? 'table-warning' : ''}">
                    <td>
                        <strong class="text-primary">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong></td>
                    <td><strong class="fs-6">${maxCapacity.toLocaleString()}</strong></td>
                    <td class="text-${utilizationClass}">
                        <strong class="fs-6">${availableSeats.toLocaleString()}</strong> seats
                    </td>
                    <td style="width: 200px;">
                        <div class="progress" style="height: 24px;">
                            <div class="progress-bar bg-${utilizationClass}" style="width: ${utilizationPercent}%">
                                <strong>${utilizationPercent}%</strong>
                            </div>
                        </div>
                    </td>
                    <td>${actionBadge}</td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

// ============================================
// ENHANCED SUBJECTS CATALOG TABLE
// ============================================
function renderSubjectsTable(subjects) {
    const tbody = document.getElementById("subjectsTableBody");
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        No subjects data available
                    </td>
                </tr>`;
        return;
    }

    // Sort by module code
    subjects.sort((a, b) => a.code_module.localeCompare(b.code_module));

    const html = subjects.map(subject => {
        const semester = subject.code_presentation.includes('B') ?
            '<span class="badge bg-primary px-3 py-2">📅 February</span>' :
            '<span class="badge bg-warning text-dark px-3 py-2">📅 October</span>';

        // ✅ Duration from courses.csv (stored as 'length')
        const duration = subject.module_presentation_length || subject.length || 'N/A';
        const durationDisplay = duration !== 'N/A' ? `${duration} days` : 'N/A';

        // Status based on enrollment size
        let statusBadge;
        if (subject.enrolments > 1500) {
            statusBadge = '<span class="badge bg-success px-3 py-2">✅ Active - High</span>';
        } else if (subject.enrolments > 800) {
            statusBadge = '<span class="badge bg-info px-3 py-2">✅ Active - Normal</span>';
        } else if (subject.enrolments > 300) {
            statusBadge = '<span class="badge bg-warning px-3 py-2">⚠️ Active - Low</span>';
        } else {
            statusBadge = '<span class="badge bg-danger px-3 py-2">⚠️ Under Review</span>';
        }

        return `
                <tr>
                    <td>
                        <strong class="text-primary fs-6">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td>${semester}</td>
                    <td><strong>${durationDisplay}</strong></td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong> students</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

// Render demand analysis table (separate from subjects catalog)
function renderDemandTable(subjects) {
    const tbody = document.getElementById("demandTableBody");
    if (!tbody) return;

    if (!subjects || subjects.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        No demand data available
                    </td>
                </tr>`;
        return;
    }

    const html = subjects.map(subject => {
        // Simulate enrollment trend (in real system, compare with previous semester)
        const trendRandom = Math.random();
        let trendBadge, trendIcon, forecast, demandLevel;

        if (trendRandom > 0.6) {
            // Growing (40% chance)
            const growthPercent = Math.floor(Math.random() * 20) + 5; // 5-25% growth
            trendBadge = `<span class="badge bg-success px-3 py-2">📈 Growing +${growthPercent}%</span>`;
            trendIcon = '📈';
            forecast = `Expected ${Math.floor(subject.enrolments * (1 + growthPercent / 100)).toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-success fs-6 px-3 py-2">🔥 High Demand</span>';
        } else if (trendRandom > 0.3) {
            // Stable (30% chance)
            trendBadge = '<span class="badge bg-info px-3 py-2">➡️ Stable ±3%</span>';
            trendIcon = '➡️';
            forecast = `Expected ${subject.enrolments.toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-info fs-6 px-3 py-2">📊 Steady</span>';
        } else {
            // Declining (30% chance)
            const declinePercent = Math.floor(Math.random() * 15) + 5; // 5-20% decline
            trendBadge = `<span class="badge bg-danger px-3 py-2">📉 Declining -${declinePercent}%</span>`;
            trendIcon = '📉';
            forecast = `Expected ${Math.floor(subject.enrolments * (1 - declinePercent / 100)).toLocaleString()} next semester`;
            demandLevel = '<span class="badge bg-warning text-dark fs-6 px-3 py-2">⚠️ Declining</span>';
        }

        return `
                <tr>
                    <td>
                        <strong class="text-primary fs-6">${subject.code_module}</strong>
                        <br>
                        <small class="text-muted">${subject.code_presentation}</small>
                    </td>
                    <td><strong class="fs-6">${subject.enrolments.toLocaleString()}</strong> students</td>
                    <td>${trendBadge}</td>
                    <td>${demandLevel}</td>
                    <td><small class="text-muted">${forecast}</small></td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;
}

function generateSubjectsFromEnrolments(enrolments, courses = []) {
    console.log('🔍 Generating subjects from enrollments...');
    console.log('📚 Courses available:', courses.length);

    // Create lookup map for quick access
    const courseLookup = {};
    courses.forEach(course => {
        const key = `${course.code_module}_${course.code_presentation}`;
        courseLookup[key] = course.length; // ✅ Use 'length' from courses.csv
    });

    console.log('🗺️ Course lookup keys:', Object.keys(courseLookup).slice(0, 5));
    console.log('📝 Enrollment keys:', Object.keys(enrolments).slice(0, 5));

    return Object.entries(enrolments).map(([key, count]) => {
        let parts = key.includes('_') ? key.split('_') : key.split('-');
        const module = parts[0] || 'Unknown';
        const presentation = parts[1] || 'Unknown';

        // Look up duration from courses data
        const lookupKey = `${module}_${presentation}`;
        const duration = courseLookup[lookupKey] || 'N/A';

        if (duration === 'N/A') {
            console.warn(`⚠️ No duration found for: ${lookupKey}`);
        }

        return {
            code_module: module,
            code_presentation: presentation,
            length: duration, // ✅ Store as 'length' to match courses.csv
            module_presentation_length: duration, // Keep for backward compatibility
            enrolments: count
        };
    });
}

function renderAdminSummary(data) {
    // Calculate total students from ALL outcomes
    const outcomes = data.outcomes || {};
    const totalStudents = Object.values(outcomes).reduce((a, b) => a + b, 0);
    const totalCourses = Object.keys(data.enrolments || {}).length;
    const totalEnrolments = Object.values(data.enrolments || {}).reduce((a, b) => a + b, 0);

    const totalCompleted = (outcomes.Pass || 0) + (outcomes.Fail || 0) + (outcomes.Distinction || 0);
    const passRate = totalCompleted > 0
        ? (((outcomes.Pass || 0) + (outcomes.Distinction || 0)) / totalCompleted * 100).toFixed(1)
        : 0;

    const totalStudentsEl = document.getElementById("totalStudentsCount");
    const totalCoursesEl = document.getElementById("totalCoursesCount");
    const totalEnrolmentsEl = document.getElementById("totalEnrolmentsCount");
    const passRateEl = document.getElementById("passRatePercent");

    if (totalStudentsEl) totalStudentsEl.textContent = totalStudents.toLocaleString();
    if (totalCoursesEl) totalCoursesEl.textContent = totalCourses;
    if (totalEnrolmentsEl) totalEnrolmentsEl.textContent = totalEnrolments.toLocaleString();
    if (passRateEl) passRateEl.textContent = passRate + "%";
}

function renderStudentsTable(students, page = 1) {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bi bi-person-x fs-1 d-block mb-2"></i>
                        No students data available
                    </td>
                </tr>`;
        return;
    }

    const startIndex = (page - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    const paginatedStudents = students.slice(startIndex, endIndex);

    const html = paginatedStudents.map(student => {
        const statusClass = {
            'Pass': 'success',
            'Distinction': 'primary',
            'Fail': 'danger',
            'Withdrawn': 'warning'
        }[student.final_result] || 'secondary';

        const isActive = student.final_result !== 'Withdrawn';
        const statusBadge = isActive ?
            '<span class="status-badge bg-success">Active</span>' :
            '<span class="status-badge bg-warning">Withdrawn</span>';

        return `
                <tr>
                    <td><strong>${student.id_student}</strong></td>
                    <td>${student.modules_enrolled || 'N/A'}</td>
                    <td>${student.studied_credits || 0}</td>
                    <td><span class="badge bg-${statusClass}">${student.final_result}</span></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
    }).join('');

    tbody.innerHTML = html;

    const studentsCountEl = document.getElementById("studentsCount");
    const currentPageEl = document.getElementById("currentPage");
    if (studentsCountEl) studentsCountEl.textContent = students.length;
    if (currentPageEl) currentPageEl.textContent = page;

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    if (prevBtn) prevBtn.disabled = page === 1;
    if (nextBtn) nextBtn.disabled = endIndex >= students.length;
}

function setupAdminFilters() {
    const searchSubjects = document.getElementById("searchSubjects");
    if (searchSubjects) {
        searchSubjects.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allSubjectsData.filter(subject =>
                subject.code_module.toLowerCase().includes(query) ||
                subject.code_presentation.toLowerCase().includes(query)
            );
            renderSubjectsTable(filtered);
        }, 300));
    }

    const searchStudents = document.getElementById("searchStudents");
    if (searchStudents) {
        searchStudents.addEventListener('input', debounce((e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allStudentsData.filter(student =>
                student.id_student.toString().includes(query)
            );
            currentPage = 1;
            renderStudentsTable(filtered, currentPage);
        }, 300));
    }

    const filterStatus = document.getElementById("filterStatus");
    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            const status = e.target.value;
            let filtered = allStudentsData;

            if (status === 'active') {
                filtered = allStudentsData.filter(s => s.final_result !== 'Withdrawn');
            } else if (status === 'withdrawn') {
                filtered = allStudentsData.filter(s => s.final_result === 'Withdrawn');
            } else if (status === 'completed') {
                filtered = allStudentsData.filter(s =>
                    ['Pass', 'Distinction', 'Fail'].includes(s.final_result)
                );
            }

            currentPage = 1;
            renderStudentsTable(filtered, currentPage);
        });
    }

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderStudentsTable(allStudentsData, currentPage);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const maxPages = Math.ceil(allStudentsData.length / studentsPerPage);
            if (currentPage < maxPages) {
                currentPage++;
                renderStudentsTable(allStudentsData, currentPage);
            }
        });
    }
}

function renderEnrolmentChart(enrolments) {
    const ctx = document.getElementById("enrolChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(enrolments),
            datasets: [{
                label: "Enrolments",
                data: Object.values(enrolments),
                backgroundColor: "rgba(52, 152, 219, 0.7)",
                borderColor: "#3498db",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Course (Module-Presentation)"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of Enrolments"
                    }
                }
            }
        }
    });
}

function renderGenderChart(gender) {
    const ctx = document.getElementById("genderChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Male", "Female"],
            datasets: [{
                data: [gender["M"] || 0, gender["F"] || 0],
                backgroundColor: ["#2196f3", "#e91e63"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Gender Distribution"
                }
            }
        }
    });
}

function renderAgeChart(age) {
    const ctx = document.getElementById("ageChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["🧑‍🎓 Young (0-35)", "👨 Adult (36-55)", "👴 Older (55+)"],
            datasets: [{
                label: "Age Distribution",
                data: [
                    age["0-35"] || 0,
                    age["35-55"] || 0,
                    age["55<="] || 0
                ],
                backgroundColor: ["#2196f3", "#4caf50", "#ff9800"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Age Band Distribution"
                }
            }
        }
    });
}

function renderOutcomeChart(outcomes) {
    const ctx = document.getElementById("outcomeChart");
    if (!ctx) return;

    new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["✅ Pass", "❌ Fail", "🔄 Withdrawn", "🏆 Distinction"],
            datasets: [{
                label: "Final Outcomes",
                data: [
                    outcomes["Pass"] || 0,
                    outcomes["Fail"] || 0,
                    outcomes["Withdrawn"] || 0,
                    outcomes["Distinction"] || 0
                ],
                backgroundColor: ["#4caf50", "#f44336", "#ff9800", "#2196f3"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: "Final Outcomes Distribution"
                }
            }
        }
    });

    const passCount = document.getElementById("passCount");
    const failCount = document.getElementById("failCount");
    const withdrawCount = document.getElementById("withdrawCount");
    const distCount = document.getElementById("distCount");
    if (passCount) passCount.textContent = (outcomes["Pass"] || 0).toLocaleString();
    if (failCount) failCount.textContent = (outcomes["Fail"] || 0).toLocaleString();
    if (withdrawCount) withdrawCount.textContent = (outcomes["Withdrawn"] || 0).toLocaleString();
    if (distCount) distCount.textContent = (outcomes["Distinction"] || 0).toLocaleString();
}

// ============================================
// AUTO-INITIALIZATION
// ============================================
if (document.getElementById("progressChart")) {
    loadStudentData("11391");
}

if (document.getElementById("classChart")) {
    populateModuleDropdown();
}

if (document.getElementById("enrolChart")) {
    loadAdminData();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString();
}

function calculatePercentage(value, total) {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
}

function getGradeClassification(score) {
    if (score >= 80) return { grade: 'Distinction', class: 'success' };
    if (score >= 60) return { grade: 'Merit', class: 'info' };
    if (score >= 40) return { grade: 'Pass', class: 'warning' };
    return { grade: 'Fail', class: 'danger' };
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function exportToCSV(data, filename) {
    const csv = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(
            document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});


window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (typeof Chart !== 'undefined' && Chart.instances) {
            Object.values(Chart.instances).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        }
    }, 250);
});

function printDashboard() {
    window.print();
}

function refreshDashboard() {
    if (document.getElementById("progressChart")) {
        showToast('Refreshing student data...', 'info');
        if (typeof loadStudentData === 'function') {
            loadStudentData("11391");
        }
    } else if (document.getElementById("classChart")) {
        const moduleCode = document.getElementById("module")?.value;
        showToast('Refreshing lecturer data...', 'info');
        if (typeof loadLecturerData === 'function') {
            loadLecturerData(moduleCode);
        }
    } else if (document.getElementById("enrolChart")) {
        showToast('Refreshing admin data...', 'info');
        loadAdminData();
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`Page load time: ${pageLoadTime}ms`);
    });
}
/* ============================================
// ✨ ENHANCED INTERACTIVE FEATURES ✨
// ============================================

// Global variables for interactive features
let timelineData = [];
let currentTimelineFilter = 'all';

// 🎯 FEATURE 1: INTERACTIVE STUDY TIMELINE
function generateInteractiveTimeline(data) {
    timelineData = [];

    if (data.scores && data.scores.length > 0) {
        data.scores.forEach(score => {
            timelineData.push({
                type: 'assessment',
                date: score.date_submitted,
                title: `${score.assessment_type} Submitted`,
                module: score.code_module,
                score: score.score,
                icon: 'clipboard-check',
                details: `Score: ${score.score}% | ${score.score >= 40 ? 'Passed ✅' : 'Failed ❌'}`,
                color: score.score >= 70 ? '#2ecc71' : score.score >= 40 ? '#f39c12' : '#e74c3c'
            });
        });
    }

    if (data.activity && data.activity.length > 0) {
        data.activity.forEach(act => {
            if (act.sum_click > 50) {
                timelineData.push({
                    type: 'activity',
                    date: act.date,
                    title: 'High Engagement Day',
                    icon: 'mouse',
                    details: `${act.sum_click} VLE interactions`,
                    color: '#3498db'
                });
            }
        });
    }

    if (data.assessments && data.currentDay) {
        data.assessments.forEach(assessment => {
            if (assessment.date > data.currentDay) {
                const daysLeft = assessment.date - data.currentDay;
                timelineData.push({
                    type: 'deadline',
                    date: assessment.date,
                    title: `Upcoming ${assessment.assessment_type}`,
                    module: assessment.code_module,
                    icon: 'calendar-event',
                    details: `${daysLeft} days remaining`,
                    color: daysLeft < 7 ? '#e74c3c' : '#f39c12'
                });
            }
        });
    }

    if (data.scores && data.scores.length > 0) {
        data.scores.filter(s => s.score >= 80).forEach(score => {
            timelineData.push({
                type: 'achievement',
                date: score.date_submitted,
                title: '🎉 Achievement Unlocked!',
                module: score.code_module,
                icon: 'trophy',
                details: `High Score: ${score.score}% in ${score.assessment_type}`,
                color: '#9b59b6'
            });
        });
    }

    timelineData.sort((a, b) => a.date - b.date);

    renderInteractiveTimeline();
}

function renderInteractiveTimeline() {
    let container = document.getElementById('interactiveTimeline');

    if (!container) {
        const updatesSection = document.querySelector('#updatesFeed').closest('.col-12');
        const timelineSection = document.createElement('div');
        timelineSection.className = 'col-12 mt-4';
        timelineSection.innerHTML = `
            <div class="card">
                <div class="card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <i class="bi bi-clock-history me-2"></i>
                    Interactive Study Timeline
                </div>
                <div class="card-body">
                    <div class="mb-3 position-relative">
                        <input type="text" id="timelineSearch" class="form-control" 
                               placeholder="🔍 Search timeline events..." 
                               onkeyup="filterTimelineBySearch()" 
                               style="padding-left: 40px; border-radius: 25px;">
                        <i class="bi bi-search position-absolute" style="left: 15px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                    </div>
                    
                    <div class="d-flex gap-2 mb-3 flex-wrap" id="timelineFilters">
                        <button class="btn btn-sm btn-outline-primary active" onclick="setTimelineFilter('all')">
                            <i class="bi bi-grid-3x3"></i> All
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="setTimelineFilter('assessment')">
                            <i class="bi bi-clipboard-check"></i> Assessments
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="setTimelineFilter('activity')">
                            <i class="bi bi-mouse"></i> Activities
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="setTimelineFilter('deadline')">
                            <i class="bi bi-calendar-event"></i> Deadlines
                        </button>
                        <button class="btn btn-sm btn-outline-purple" onclick="setTimelineFilter('achievement')">
                            <i class="bi bi-trophy"></i> Achievements
                        </button>
                    </div>
                    
                    <div id="interactiveTimeline" style="max-height: 600px; overflow-y: auto;"></div>
                </div>
            </div>
        `;

        if (updatesSection && updatesSection.nextElementSibling) {
            updatesSection.parentNode.insertBefore(timelineSection, updatesSection.nextElementSibling);
        } else if (updatesSection) {
            updatesSection.parentNode.appendChild(timelineSection);
        }

        container = document.getElementById('interactiveTimeline');
    }

    const filtered = currentTimelineFilter === 'all'
        ? timelineData
        : timelineData.filter(item => item.type === currentTimelineFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info text-center">
                <i class="bi bi-info-circle me-2"></i>
                No timeline events found
            </div>
        `;
        return;
    }

    const html = `
        <div class="timeline-wrapper position-relative" style="padding: 20px 0;">
            <div class="timeline-line position-absolute" 
                 style="left: 40px; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, #667eea, #764ba2);"></div>
            
            ${filtered.map((item, index) => `
                <div class="timeline-item position-relative mb-4 ps-5" 
                     data-type="${item.type}" 
                     style="padding-left: 80px; cursor: pointer; transition: all 0.3s ease;"
                     onclick="toggleTimelineDetails(${index})"
                     onmouseenter="this.style.backgroundColor='rgba(102, 126, 234, 0.05)'; this.style.paddingLeft='90px'; this.style.borderRadius='10px'"
                     onmouseleave="this.style.backgroundColor='transparent'; this.style.paddingLeft='80px'">
                    
                    <div class="position-absolute text-muted fw-bold" 
                         style="left: 0; top: 20px; font-size: 11px;">
                        Day ${item.date}
                    </div>
                    
                    <div class="timeline-dot position-absolute rounded-circle bg-white" 
                         style="left: 32px; top: 20px; width: 18px; height: 18px; 
                                border: 4px solid ${item.color}; z-index: 2;
                                transition: all 0.3s ease;">
                    </div>
                    
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">
                                        <i class="bi bi-${item.icon} me-2" style="color: ${item.color}"></i>
                                        ${item.title}
                                    </h6>
                                    ${item.module ? `<span class="badge" style="background-color: ${getColorForModule(item.module)}">${item.module}</span>` : ''}
                                </div>
                                <i class="bi bi-chevron-down text-muted timeline-chevron-${index}" style="transition: transform 0.3s ease;"></i>
                            </div>
                            
                            <div class="timeline-details-${index} mt-2" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
                                <hr class="my-2">
                                <p class="mb-0 text-muted small">${item.details}</p>
                                ${item.score ? `
                                    <div class="progress mt-2" style="height: 20px;">
                                        <div class="progress-bar" 
                                             style="width: ${item.score}%; background-color: ${item.color}">
                                            ${item.score}%
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
} */


function toggleTimelineDetails(index) {
    const details = document.querySelector(`.timeline-details-${index}`);
    const chevron = document.querySelector(`.timeline-chevron-${index}`);

    if (details.style.maxHeight === '0px' || !details.style.maxHeight) {
        details.style.maxHeight = '200px';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        details.style.maxHeight = '0';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

function setTimelineFilter(filter) {
    currentTimelineFilter = filter;

    document.querySelectorAll('#timelineFilters button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    renderInteractiveTimeline();
}

function filterTimelineBySearch() {
    const searchTerm = document.getElementById('timelineSearch').value.toLowerCase();
    const items = document.querySelectorAll('.timeline-item');

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// 🎯 FEATURE 2: INTERACTIVE CHART CONTROLS
function addInteractiveChartControls() {
    const progressCard = document.querySelector('#progressChart')?.closest('.card');
    if (progressCard) {
        const header = progressCard.querySelector('.card-header');
        if (header && !header.querySelector('.chart-controls')) {
            const controls = document.createElement('div');
            controls.className = 'chart-controls d-inline-flex gap-2 ms-auto';
            controls.innerHTML = `
                <button class="btn btn-sm btn-light active" onclick="changeProgressChartType('line')" data-chart="line">
                    <i class="bi bi-graph-up"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeProgressChartType('bar')" data-chart="bar">
                    <i class="bi bi-bar-chart"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeProgressChartType('scatter')" data-chart="scatter">
                    <i class="bi bi-diagram-3"></i>
                </button>
            `;
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.appendChild(controls);
        }
    }

    const activityCard = document.querySelector('#activityChart')?.closest('.card');
    if (activityCard) {
        const header = activityCard.querySelector('.card-header');
        if (header && !header.querySelector('.chart-controls')) {
            const controls = document.createElement('div');
            controls.className = 'chart-controls d-inline-flex gap-2 ms-auto';
            controls.innerHTML = `
                <button class="btn btn-sm btn-light active" onclick="changeActivityChartType('bar')" data-chart="bar">
                    <i class="bi bi-bar-chart-fill"></i>
                </button>
                <button class="btn btn-sm btn-light" onclick="changeActivityChartType('line')" data-chart="line">
                    <i class="bi bi-graph-up"></i>
                </button>
            `;
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.appendChild(controls);
        }
    }
}

function changeProgressChartType(type) {
    if (!progressChartInstance) return;

    document.querySelectorAll('[onclick^="changeProgressChartType"]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    progressChartInstance.config.type = type;

    if (type === 'scatter') {
        progressChartInstance.options.plugins.legend.display = true;
    }

    progressChartInstance.update('active');
}

function changeActivityChartType(type) {
    if (!activityChartInstance) return;

    document.querySelectorAll('[onclick^="changeActivityChartType"]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');

    activityChartInstance.config.type = type;
    activityChartInstance.update('active');
}

// 7️⃣ INTERACTIVE PERFORMANCE CARDS (ENHANCED WITH DRILL-DOWN)
function makePerformanceCardsInteractive() {
    setTimeout(() => {
        const cards = document.querySelectorAll('#performanceSummary .card');

        cards.forEach((card, index) => {
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s ease';

            card.addEventListener('mouseenter', function () {
                this.style.transform = 'scale(1.05) translateY(-5px)';
                this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = 'scale(1) translateY(0)';
                this.style.boxShadow = '';
            });

            // 🆕 DRILL-DOWN: Click to see details
            card.addEventListener('click', function () {
                const cardTitle = this.querySelector('small').textContent;
                const cardValue = this.querySelector('h3').textContent;

                // Show detailed breakdown based on which card was clicked
                showPerformanceDetails(index, cardTitle, cardValue);
            });
        });
    }, 1000);
}

// 🆕 DRILL-DOWN FUNCTION
// 🆕 ALTERNATIVE: Show details in expandable section (NO MODAL)
function showPerformanceDetails(cardIndex, title, value) {
    const data = window.studentData;
    if (!data || !data.scores) return;

    let detailsHTML = '';

    switch (cardIndex) {
        case 0: // Total Assessments
            detailsHTML = generateTotalAssessmentsDetails(data.scores);
            break;
        case 1: // Average Score
            detailsHTML = generateAverageScoreDetails(data.scores);
            break;
        case 2: // Passed Assessments
            detailsHTML = generatePassedAssessmentsDetails(data.scores);
            break;
        case 3: // Best Score
            detailsHTML = generateBestScoreDetails(data.scores);
            break;
    }

    // Show in expandable section instead of modal
    showDetailsExpanded(title, detailsHTML);
}

// Show details in an expandable card below performance summary
function showDetailsExpanded(title, content) {
    // Check if details section already exists
    let detailsSection = document.getElementById('performanceDetails');

    if (!detailsSection) {
        // Create new section after performance summary
        detailsSection = document.createElement('div');
        detailsSection.id = 'performanceDetails';
        detailsSection.className = 'mb-4';

        const performanceSummary = document.getElementById('overviewSection');
        performanceSummary.insertAdjacentElement('afterend', detailsSection);
    }

    // Populate with content
    detailsSection.innerHTML = `
        <div class="card border-primary" style="animation: slideDown 0.3s ease;">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-zoom-in me-2"></i>${title} - Detailed View
                </h5>
                <button class="btn btn-sm btn-light" onclick="closePerformanceDetails()">
                    <i class="bi bi-x-lg"></i> Close
                </button>
            </div>
            <div class="card-body">
                ${content}
            </div>
        </div>
    `;

    // Scroll to details
    detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Close details section
function closePerformanceDetails() {
    const detailsSection = document.getElementById('performanceDetails');
    if (detailsSection) {
        detailsSection.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            detailsSection.remove();
        }, 300);
    }
}

// Generate details for each card type
function generateTotalAssessmentsDetails(scores) {
    const html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>Module</th>
                        <th>Assessment Type</th>
                        <th>Date</th>
                        <th>Score</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.map((s, i) => {
        const statusClass = Number(s.score) >= 70 ? 'success' :
            Number(s.score) >= 40 ? 'warning' : 'danger';
        const statusText = Number(s.score) >= 70 ? 'Excellent' :
            Number(s.score) >= 40 ? 'Pass' : 'Fail';

        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td><span class="badge" style="background: ${getColorForModule(s.code_module)}">${s.code_module}</span></td>
                                <td>${s.assessment_type || 'Assessment'}</td>
                                <td>Day ${s.date_submitted}</td>
                                <td><strong>${s.score}%</strong></td>
                                <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function generateAverageScoreDetails(scores) {
    // Group by module
    const moduleGroups = {};
    scores.forEach(s => {
        if (!moduleGroups[s.code_module]) {
            moduleGroups[s.code_module] = [];
        }
        moduleGroups[s.code_module].push(Number(s.score));
    });

    const html = `
        <div class="row g-3">
            ${Object.entries(moduleGroups).map(([module, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const color = avg >= 70 ? 'success' : avg >= 40 ? 'warning' : 'danger';

        return `
                    <div class="col-md-6">
                        <div class="card border-${color}">
                            <div class="card-body">
                                <h5 style="color: ${getColorForModule(module)}">${module}</h5>
                                <div class="display-6 text-${color}">${avg.toFixed(1)}%</div>
                                <small class="text-muted">${scores.length} assessments</small>
                                <div class="progress mt-2" style="height: 10px;">
                                    <div class="progress-bar bg-${color}" style="width: ${avg}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
    return html;
}

function generatePassedAssessmentsDetails(scores) {
    const passed = scores.filter(s => Number(s.score) >= 40);
    const failed = scores.filter(s => Number(s.score) < 40);

    const html = `
        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle me-2"></i>Passed: ${passed.length}</h5>
                    <ul class="mb-0">
                        ${passed.slice(0, 5).map(s => `
                            <li>${s.code_module}: ${s.score}%</li>
                        `).join('')}
                        ${passed.length > 5 ? `<li class="text-muted">...and ${passed.length - 5} more</li>` : ''}
                    </ul>
                </div>
            </div>
            <div class="col-md-6">
                <div class="alert alert-danger">
                    <h5><i class="bi bi-x-circle me-2"></i>Failed: ${failed.length}</h5>
                    ${failed.length > 0 ? `
                        <ul class="mb-0">
                            ${failed.map(s => `
                                <li>${s.code_module}: ${s.score}%</li>
                            `).join('')}
                        </ul>
                    ` : '<p class="mb-0">No failed assessments! Great job!</p>'}
                </div>
            </div>
        </div>
    `;
    return html;
}

function generateBestScoreDetails(scores) {
    const sorted = [...scores].sort((a, b) => Number(b.score) - Number(a.score));
    const top5 = sorted.slice(0, 5);

    const html = `
        <div class="list-group">
            ${top5.map((s, i) => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-warning text-dark me-2">#${i + 1}</span>
                        <strong>${s.code_module}</strong>
                        <br>
                        <small class="text-muted">${s.assessment_type || 'Assessment'} - Day ${s.date_submitted}</small>
                    </div>
                    <div class="text-end">
                        <h4 class="mb-0 text-success">${s.score}%</h4>
                        ${i === 0 ? '<i class="bi bi-trophy-fill text-warning fs-3"></i>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    return html;
}

// Show details in a modal
function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
} function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
} function showDetailsModal(title, content) {
    // Remove any existing modal first
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        const existingInstance = bootstrap.Modal.getInstance(existingModal);
        if (existingInstance) {
            existingInstance.dispose();
        }
        existingModal.remove();
    }

    // Remove any leftover backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    // Create fresh modal
    const modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'detailsModalTitle');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="detailsModalTitle">
                        <i class="bi bi-info-circle me-2"></i>${title}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="detailsModalBody">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle me-1"></i>Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Show modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Clean up when hidden
    modal.addEventListener('hidden.bs.modal', function () {
        modalInstance.dispose();
        modal.remove();

        // Ensure body is clean
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove any orphaned backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });
}

// 🎯 FEATURE 4: INTERACTIVE MODULE PROGRESS
function makeModuleProgressInteractive() {
    const container = document.getElementById('progressBars');
    if (!container) return;

    const progressBars = container.querySelectorAll('.progress');

    progressBars.forEach((bar, index) => {
        bar.style.cursor = 'pointer';
        bar.style.transition = 'all 0.3s ease';

        bar.addEventListener('mouseenter', function () {
            this.style.height = '35px';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });

        bar.addEventListener('mouseleave', function () {
            this.style.height = '28px';
            this.style.boxShadow = '';
        });

        bar.addEventListener('click', function () {
            const moduleDiv = this.closest('.mb-3');
            const moduleName = moduleDiv.querySelector('strong').textContent;
            const moduleInfo = moduleDiv.querySelector('.text-muted').textContent;
            const avgScore = this.querySelector('.progress-bar strong').textContent;

            showToast(`${moduleName}: ${avgScore} | ${moduleInfo}`, 'primary');
        });
    });
}

// 🎯 FEATURE 5: ANIMATED PROGRESS BARS
function animateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-bar');

    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';

        setTimeout(() => {
            bar.style.transition = 'width 1s ease';
            bar.style.width = width;
        }, 100);
    });
}

// 🎯 FEATURE 6: CLICK-TO-EXPAND SECTIONS
function addExpandableFeatures() {
    const updatesContainer = document.getElementById('updatesFeed');
    if (updatesContainer) {
        const alerts = updatesContainer.querySelectorAll('.alert');
        alerts.forEach(alert => {
            alert.style.cursor = 'pointer';
            alert.addEventListener('click', function () {
                this.classList.toggle('expanded');
                const height = this.classList.contains('expanded') ? 'auto' : '';
                this.style.maxHeight = height;
            });
        });
    }
}

/* ============================================================
   FULLSCREEN MODAL – AT-RISK STUDENTS
============================================================ */

function generateRiskReason(s) {
    let reasons = [];

    if (s.missingTasks > 0) reasons.push(`${s.missingTasks} missing tasks`);
    if (s.daysSinceLogin > 7) reasons.push(`No login for ${s.daysSinceLogin} days`);
    if (s.clicks < 10) reasons.push("Low VLE activity");

    return reasons.length ? reasons.join(" + ") : "Low score";
}

function openAtRiskModal() {
    let modal = new bootstrap.Modal(document.getElementById("atRiskModal"));
    modal.show();

    let students = moduleData.students.filter(s => s.score < 40);
    let critical = students.filter(s => s.score < 30).length;
    let moderate = students.filter(s => s.score >= 30 && s.score <= 39).length;

    // Update summary counts
    document.getElementById("modalCriticalCount").textContent = critical;
    document.getElementById("modalModerateCount").textContent = moderate;
    document.getElementById("modalTotalRisk").textContent = students.length;

    // Table
    let table = document.getElementById("atRiskModalTable");
    table.innerHTML = "";

    students.forEach(s => {
        let level = s.score < 30 ? "Critical" : "Moderate";
        let color = s.score < 30 ? "text-danger" : "text-warning";
        let reason = generateRiskReason(s);

        table.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td>${s.score}%</td>
                <td class="${color} fw-bold">${level}</td>
                <td>${s.missingTasks}</td>
                <td>${s.daysSinceLogin} days</td>
                <td>${s.clicks} clicks</td>
                <td>${reason}</td>
            </tr>
        `;
    });
}


/* ============================================================
   FULLSCREEN MODAL – PARTICIPATION TRENDS
============================================================ */

function openParticipationModal() {
    let modal = new bootstrap.Modal(document.getElementById("participationModal"));
    modal.show();

    let table = document.getElementById("participationModalTable");
    table.innerHTML = "";

    let active = 0;
    let low = 0;
    let notAttending = 0;

    moduleData.students.forEach(s => {
        let status = "";
        let reason = "";

        if (s.clicks >= 20) {
            status = "🟢 Active";
            active++;
            reason = "Regular weekly activity";
        }
        else if (s.clicks >= 8) {
            status = "🟡 Low";
            low++;
            reason = "Lower than expected activity";
        }
        else {
            status = "🔴 Not Attending";
            notAttending++;
            reason = s.daysSinceLogin > 10
                ? "No login in over 10 days"
                : "Very low VLE interaction";
        }

        table.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td>${s.clicks}</td>
                <td>${100 - s.daysSinceLogin}%</td>
                <td>${status}</td>
                <td>${reason}</td>
            </tr>
        `;
    });

    // Update summary cards inside modal
    document.getElementById("modalActiveCount").textContent = active;
    document.getElementById("modalLowEngagementCount").textContent = low;
    document.getElementById("modalNotAttendingCount").textContent = notAttending;
}


// ============================================
// ENHANCED INITIALIZATION
// ============================================
function initializeInteractiveFeatures(data) {
    setTimeout(() => {
        //generateInteractiveTimeline(data);
        addInteractiveChartControls();
        makePerformanceCardsInteractive();
        makeModuleProgressInteractive();
        animateProgressBars();
        addExpandableFeatures();

        console.log('✅ Interactive features initialized!');
    }, 500);
}