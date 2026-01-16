// api/admin.js - Vercel Serverless Function
const fs = require('fs');
const path = require('path');

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i]?.trim() || '';
        });
        return obj;
    });
}

module.exports = async (req, res) => {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // Read CSV files from the public directory
        const studentInfoPath = path.join(process.cwd(), 'public', 'studentInfo.csv');
        const studentRegistrationPath = path.join(process.cwd(), 'public', 'studentRegistration.csv');
        const studentAssessmentPath = path.join(process.cwd(), 'public', 'studentAssessment.csv');

        // Check if files exist
        if (!fs.existsSync(studentInfoPath)) {
            return res.status(404).json({ error: 'Student data files not found' });
        }

        const studentInfo = parseCSV(fs.readFileSync(studentInfoPath, 'utf8'));
        const studentRegistration = parseCSV(fs.readFileSync(studentRegistrationPath, 'utf8'));
        const studentAssessment = parseCSV(fs.readFileSync(studentAssessmentPath, 'utf8'));

        // Calculate aggregated data
        const outcomes = {};
        studentInfo.forEach(s => {
            const result = s.final_result || 'Unknown';
            outcomes[result] = (outcomes[result] || 0) + 1;
        });

        const enrolments = {};
        studentRegistration.forEach(r => {
            const key = `${r.code_module}_${r.code_presentation}`;
            enrolments[key] = (enrolments[key] || 0) + 1;
        });

        const gender = {};
        studentInfo.forEach(s => {
            const g = s.gender || 'Unknown';
            gender[g] = (gender[g] || 0) + 1;
        });

        const age = {
            "0-35": 0,
            "35-55": 0,
            "55<=": 0
        };
        studentInfo.forEach(s => {
            const band = s.age_band || '0-35';
            if (age[band] !== undefined) {
                age[band]++;
            }
        });

        res.status(200).json({
            outcomes,
            enrolments,
            gender,
            age,
            students: studentInfo.slice(0, 100), // Return first 100 students
            totalStudents: studentInfo.length
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};