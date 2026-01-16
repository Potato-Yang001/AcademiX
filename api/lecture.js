// api/lecturer/[moduleCode].js - Vercel Serverless Function
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
        const { moduleCode } = req.query;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (!moduleCode) {
            return res.status(400).json({ error: 'Module code is required' });
        }

        // Read CSV files
        const studentAssessmentPath = path.join(process.cwd(), 'public', 'studentAssessment.csv');
        const studentVlePath = path.join(process.cwd(), 'public', 'studentVle.csv');

        if (!fs.existsSync(studentAssessmentPath)) {
            return res.status(404).json({ error: 'Assessment data not found' });
        }

        const allAssessments = parseCSV(fs.readFileSync(studentAssessmentPath, 'utf8'));
        const allVle = parseCSV(fs.readFileSync(studentVlePath, 'utf8'));

        // Filter by module
        const scores = allAssessments.filter(a => a.code_module === moduleCode);
        const vleData = allVle.filter(v => v.code_module === moduleCode);

        // Calculate trends
        const trendMap = {};
        vleData.forEach(v => {
            const day = parseInt(v.date) || 0;
            const clicks = parseInt(v.sum_click) || 0;
            trendMap[day] = (trendMap[day] || 0) + clicks;
        });

        const trends = Object.entries(trendMap)
            .map(([day, clicks]) => ({ day: parseInt(day), clicks }))
            .sort((a, b) => a.day - b.day);

        // Calculate students count
        const uniqueStudents = new Set(scores.map(s => s.id_student));

        res.status(200).json({
            moduleCode,
            scores,
            trends,
            students: uniqueStudents.size,
            totalAssessments: scores.length
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};