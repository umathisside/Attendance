const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// --- IN-MEMORY DATABASE (For Project Demo) ---
const DB = {
  users: [
    { id: 'T1', name: 'Dr. Sharma', role: 'teacher' },
    { id: 'S1', name: 'Aarav Patel', role: 'student', parentId: 'P1' },
    { id: 'S2', name: 'Ananya Roy', role: 'student', parentId: 'P2' },
    { id: 'P1', name: 'Rajesh Patel', role: 'parent', studentId: 'S1' }
  ],
  timetable: [
    { id: 'LEC1', name: 'Computer Architecture', time: '09:00 AM - 10:00 AM', teacherId: 'T1' },
    { id: 'LEC2', name: 'Data Structures', time: '10:15 AM - 11:15 AM', teacherId: 'T1' },
    { id: 'LEC3', name: 'Web Development', time: '11:30 AM - 12:30 PM', teacherId: 'T1' }
  ],
  attendance: [], // Stores { id, date, lectureId, studentId, status }
  bunkAlerts: [], // Stores flagged bunk logs
  assignments: [
    { id: 'A1', subject: 'Data Structures', title: 'Implement Linked List', dueDate: '2026-09-20', details: 'Submit source code PDF.' }
  ]
};

// --- API ENDPOINTS ---

// 1. Get Timetable
app.get('/api/timetable', (req, res) => {
  res.json(DB.timetable);
});

// 2. Get Students List
app.get('/api/students', (req, res) => {
  const students = DB.users.filter(u => u.role === 'student');
  res.json(students);
});

// 3. Mark Attendance & Automatically Trigger Bunk Alerts
app.post('/api/attendance', (req, res) => {
  const { date, lectureId, records } = req.body; 
  // records format: [ { studentId: 'S1', status: 'present' }, ... ]

  records.forEach(rec => {
    // Save or update attendance record
    const existingIndex = DB.attendance.findIndex(a => a.date === date && a.lectureId === lectureId && a.studentId === rec.studentId);
    if (existingIndex > -1) {
      DB.attendance[existingIndex].status = rec.status;
    } else {
      DB.attendance.push({ id: Date.now() + Math.random(), date, lectureId, studentId: rec.studentId, status: rec.status });
    }
  });

  // Bunk Detection Logic:
  // If student was PRESENT in a previous lecture today but ABSENT in the current lecture -> Flag Bunk!
  const currentLecIndex = DB.timetable.findIndex(l => l.id === lectureId);
  
  if (currentLecIndex > 0) {
    const prevLecId = DB.timetable[currentLecIndex - 1].id;
    
    records.forEach(rec => {
      if (rec.status === 'absent') {
        const prevRecord = DB.attendance.find(a => a.date === date && a.lectureId === prevLecId && a.studentId === rec.studentId);
        
        if (prevRecord && prevRecord.status === 'present') {
          const student = DB.users.find(u => u.id === rec.studentId);
          const currentLec = DB.timetable[currentLecIndex];
          
          // Avoid duplicate alert
          const alertExists = DB.bunkAlerts.some(b => b.date === date && b.studentId === rec.studentId && b.lectureId === lectureId);
          if (!alertExists) {
            DB.bunkAlerts.push({
              id: Date.now(),
              date,
              studentId: rec.studentId,
              studentName: student ? student.name : 'Unknown',
              lectureId,
              lectureName: currentLec.name,
              message: `ALERT: ${student ? student.name : 'Student'} was present in previous class but missing in ${currentLec.name}!`
            });
          }
        }
      }
    });
  }

  res.json({ success: true, message: 'Attendance recorded successfully.' });
});

// 4. Get Student/Parent Overview
app.get('/api/student-summary/:studentId', (req, res) => {
  const { studentId } = req.params;
  const student = DB.users.find(u => u.id === studentId);
  const studentAttendance = DB.attendance.filter(a => a.studentId === studentId);
  const studentBunks = DB.bunkAlerts.filter(b => b.studentId === studentId);

  res.json({
    student,
    attendance: studentAttendance,
    bunks: studentBunks,
    assignments: DB.assignments
  });
});

// 5. Add Assignment
app.post('/api/assignments', (req, res) => {
  const { subject, title, dueDate, details } = req.body;
  const newAssignment = { id: 'A' + (DB.assignments.length + 1), subject, title, dueDate, details };
  DB.assignments.push(newAssignment);
  res.json({ success: true, assignment: newAssignment });
});

// 6. Get Bunk Alerts
app.get('/api/bunks', (req, res) => {
  res.json(DB.bunkAlerts);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});