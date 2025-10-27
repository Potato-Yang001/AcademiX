const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Simple CSV reader
function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Preload CSVs once into memory
let studentInfo = [];
let studentAssessment = [];
let studentVle = [];
let assessments = [];   // ✅ add assessments here

async function preloadCSVs() {
    console.time("CSV Load"); // measure load time

    const [info, assess, vle, asm] = await Promise.all([
        loadCSV('./data/studentInfo.csv'),
        loadCSV('./data/studentAssessment.csv'),
        loadCSV('./data/studentVle.csv'),
        loadCSV('./data/assessments.csv')
    ]);

    studentInfo = info;
    studentAssessment = assess;
    studentVle = vle;
    assessments = asm;

    console.timeEnd("CSV Load");
    console.log("✅ CSVs loaded into memory");
}
preloadCSVs();

// ================= API ROUTES =================

// Student info
app.get('/api/student/:id', (req, res) => {
    const studentId = req.params.id.toString();

    // All studentInfo rows for this student (in case multiple modules)
    const studentRecords = studentInfo.filter(s => s.id_student.toString() === studentId);

    if (studentRecords.length === 0) {
        return res.json({ student: null, scores: [], activity: [] });
    }

    // Basic profile from the first record
    const student = studentRecords[0];

    // Scores + attach module info
    const studentScores = studentAssessment
        .filter(s => s.id_student.toString() === studentId)
        .map(s => {
            // Find which module this student record belongs to
            const match = studentRecords.find(r => r.id_student.toString() === s.id_student.toString());
            return {
                ...s,
                code_module: match ? match.code_module : "Unknown",
                code_presentation: match ? match.code_presentation : "Unknown"
            };
        });

    // Activity
    const studentActivity = studentVle.filter(a => a.id_student.toString() === studentId);

    res.json({ student, scores: studentScores, activity: studentActivity });
});

// Lecturer info (per module)
app.get('/api/lecturer/:module', (req, res) => {
    const moduleCode = req.params.module.toUpperCase(); // ✅ normalize

    // Students in this module
    const moduleStudents = studentInfo.filter(s => s.code_module.toUpperCase() === moduleCode);

    // Use preloaded assessments
    const moduleAssessments = assessments.filter(a => a.code_module.toUpperCase() === moduleCode);

    // Join studentAssessment with moduleAssessments
    const moduleScores = studentAssessment.filter(sa =>
        moduleStudents.some(s => s.id_student === sa.id_student) &&
        moduleAssessments.some(a => a.id_assessment === sa.id_assessment)
    );

    // VLE clicks
    const moduleVle = studentVle.filter(v =>
        moduleStudents.some(s =>
            s.id_student === v.id_student &&
            s.code_module === v.code_module &&
            s.code_presentation === v.code_presentation
        )
    );

    // Group clicks by date
    const trends = {};
    moduleVle.forEach(v => {
        const day = Number(v.date);
        trends[day] = (trends[day] || 0) + Number(v.sum_click);
    });

    const trendData = Object.entries(trends).map(([day, clicks]) => ({
        day: Number(day),
        clicks
    }));

    // ✅ Debug log
    console.log(`📊 Module ${moduleCode}:`, {
        students: moduleStudents.length,
        scores: moduleScores.length,
        vleRecords: moduleVle.length
    });

    res.json({
        module: moduleCode,
        students: moduleStudents,
        scores: moduleScores,
        trends: trendData
    });
});

// Admin stats
app.get('/api/admin', (req, res) => {
    const enrolments = {};
    studentInfo.forEach(s => {
        const key = `${s.code_module}-${s.code_presentation}`;
        enrolments[key] = (enrolments[key] || 0) + 1;
    });

    const results = {
        enrolments,
        gender: studentInfo.reduce((acc, s) => {
            acc[s.gender] = (acc[s.gender] || 0) + 1;
            return acc;
        }, {}),
        age: studentInfo.reduce((acc, s) => {
            acc[s.age_band] = (acc[s.age_band] || 0) + 1;
            return acc;
        }, {}),
        outcomes: studentInfo.reduce((acc, s) => {
            acc[s.final_result] = (acc[s.final_result] || 0) + 1;
            return acc;
        }, {})
    };

    res.json(results);
});

// Get distinct module codes
app.get('/api/modules', (req, res) => {
    const modules = [...new Set(studentInfo.map(s => s.code_module))];
    res.json(modules);
});

// Get distinct student IDs
app.get('/api/students', (req, res) => {
    const students = [...new Set(studentInfo.map(s => s.id_student))];
    res.json(students);
});

// ===============================================

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
