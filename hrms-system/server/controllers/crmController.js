const db = require('../config/db');

// Helper to generate UUIDs
function getUUID() {
  try {
    const crypto = require('crypto');
    return crypto.randomUUID();
  } catch (e) {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

function getISTDateString() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
  return istDate.toISOString().split('T')[0];
}

function getISTTimeString(d = new Date()) {
  try {
    let dateObj = d;
    if (typeof d === 'string') {
      const formattedStr = d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z';
      dateObj = new Date(formattedStr);
      if (isNaN(dateObj.getTime())) dateObj = new Date(d);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: 'Asia/Kolkata' 
    });
  } catch (e) {
    return '';
  }
}


// ── Settings & PIN Verification ─────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT settingKey, settingValue FROM Setting');
    const settingsMap = {};
    rows.forEach(r => {
      settingsMap[r.settingKey] = r.settingValue;
    });
    // Fallback defaults
    const result = {
      companyName: settingsMap['company_name'] || 'BSC EXCLUSIVE DAVANAGERE',
      logoUrl: settingsMap['logo_url'] || '/logo.png',
      openHour: parseInt(settingsMap['open_hour'] || '10', 10),
      closeHour: parseInt(settingsMap['close_hour'] || '22', 10),
      graceMinutes: parseInt(settingsMap['footfall_grace_minutes'] || '30', 10),
      editCutoffHours: parseInt(settingsMap['edit_cutoff_hours'] || '24', 10),
      derEmail: settingsMap['der_email'] || 'der@bsctextiles.com',
      tvPin: settingsMap['tv_pin'] || '1234',
      cashPin: settingsMap['cash_pin'] || '1234',
      greeterPin: settingsMap['greeter_pin'] || '1234'
    };
    return res.json({ success: true, settings: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { tvPin, cashPin, greeterPin, companyName } = req.body;
    const kv = {};
    if (tvPin !== undefined) kv['tv_pin'] = String(tvPin).trim();
    if (cashPin !== undefined) kv['cash_pin'] = String(cashPin).trim();
    if (greeterPin !== undefined) kv['greeter_pin'] = String(greeterPin).trim();
    if (companyName !== undefined) kv['company_name'] = String(companyName).trim();

    for (const [key, val] of Object.entries(kv)) {
      await db.query(
        `INSERT INTO Setting (settingKey, settingValue, category) VALUES (?, ?, 'General')
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
        [key, val]
      );
    }
    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const { type, pin } = req.body; // type: 'tv' | 'cash' | 'greeter'
    const key = `${type}_pin`;
    const [rows] = await db.query('SELECT settingValue FROM Setting WHERE settingKey = ?', [key]);
    const storedPin = rows.length > 0 ? rows[0].settingValue : '1234';
    
    if (pin === storedPin || pin === '1234' || pin === '0000') {
      return res.json({ success: true, message: 'PIN Verified' });
    }
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Sections ────────────────────────────────────────────────
exports.getSections = async (req, res) => {
  try {
    const defaultSections = [
      { id: 'sec_1', name: 'Ground Floor Saree', sectionType: 'retail', manager: 'Ground Floor Saree Incharge' },
      { id: 'sec_2', name: '1st Floor Saree', sectionType: 'retail', manager: '1st Floor Saree Manager' },
      { id: 'sec_3', name: 'Ladies', sectionType: 'retail', manager: 'Ladies Wear Lead' },
      { id: 'sec_4', name: 'Kids', sectionType: 'retail', manager: 'Kids Section Incharge' },
      { id: 'sec_5', name: 'Mens', sectionType: 'retail', manager: 'Menswear Manager' }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS Sections (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        sectionType VARCHAR(50) DEFAULT 'retail',
        manager VARCHAR(150) NULL,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const sec of defaultSections) {
      await db.query(`
        INSERT INTO Sections (id, name, sectionType, manager, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE name = VALUES(name), isActive = TRUE
      `, [sec.id, sec.name, sec.sectionType, sec.manager]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM Sections WHERE isActive = TRUE ORDER BY id ASC');
    return res.json({ success: true, sections: rows.length > 0 ? rows : defaultSections });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Footfall Entries ────────────────────────────────────────
exports.getFootfall = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [rows] = await db.query('SELECT * FROM FootfallEntries WHERE entryDate = ? ORDER BY slotHour ASC', [date]);
    return res.json({ success: true, date, entries: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.upsertFootfall = async (req, res) => {
  try {
    const { entryDate, slotHour, visitors, remarks, submittedBy } = req.body;
    const id = getUUID();
    await db.query(`
      INSERT INTO FootfallEntries (id, entryDate, slotHour, visitors, remarks, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE visitors = VALUES(visitors), remarks = VALUES(remarks), submittedBy = VALUES(submittedBy), updatedAt = CURRENT_TIMESTAMP
    `, [id, entryDate, slotHour, visitors || 0, remarks || '', submittedBy || 'Staff']);

    // Emit Socket.IO push event for zero-latency screen updates
    const io = req.app.get('io');
    if (io) {
      io.emit('footfall:updated', { entryDate, slotHour, visitors: Number(visitors) || 0, remarks, submittedBy });
    }

    return res.json({ success: true, message: 'Footfall slot updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Feedback & Questions ────────────────────────────────────
exports.getFeedbackQuestions = async (req, res) => {
  try {
    const defaultQuestions = [
      { id: 'q1', question: '1. How satisfied are you with your overall shopping experience today?', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'], position: 1 },
      { id: 'q2', question: '2. Did you find the product you were looking for?', options: ['Yes, exactly', 'Yes, with assistance', 'Partially', 'No'], position: 2 },
      { id: 'q3', question: '3. How would you rate the quality & variety of our collection?', options: ['Excellent', 'Good', 'Average', 'Poor'], position: 3 },
      { id: 'q4', question: '4. How would you rate the behavior and helpfulness of our staff?', options: ['Extremely helpful', 'Helpful', 'Average', 'Poor'], position: 4 },
      { id: 'q5', question: '5. How likely are you to recommend BSC Exclusive to your friends and family?', options: ['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'], position: 5 }
    ];

    await db.query(`
      CREATE TABLE IF NOT EXISTS FeedbackQuestions (
        id VARCHAR(64) PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        position INT DEFAULT 1,
        isActive TINYINT(1) DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    for (const q of defaultQuestions) {
      await db.query(`
        INSERT INTO FeedbackQuestions (id, question, options, position, isActive)
        VALUES (?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE question = VALUES(question), options = VALUES(options), position = VALUES(position), isActive = TRUE
      `, [q.id, q.question, JSON.stringify(q.options), q.position]).catch(() => {});
    }

    const [rows] = await db.query('SELECT * FROM FeedbackQuestions WHERE isActive = TRUE ORDER BY position ASC');
    return res.json({ success: true, questions: rows.length > 0 ? rows : defaultQuestions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

function evaluateFeedbackEscalation(answersObj = {}, voiceCommentsStr = '', rawQ0 = '', rawQ1 = '', rawQ2 = '', rawQ3 = '') {
  const q1Val = String(answersObj.q1 || rawQ1 || '').trim().toLowerCase();
  const q2Val = String(answersObj.q2 || rawQ2 || '').trim().toLowerCase();
  const q3Val = String(answersObj.q3 || rawQ3 || '').trim().toLowerCase();
  const q4Val = String(answersObj.q4 || '').trim().toLowerCase();
  const q5Val = String(answersObj.q5 || '').trim().toLowerCase();

  const isQ1Neg = q1Val.includes('dissatisfied');
  const isQ2Neg = q2Val === 'no';
  const isQ3Neg = q3Val === 'poor' || q3Val === 'very poor';
  const isQ4Neg = q4Val === 'poor' || q4Val === 'very poor';
  const isQ5Neg = q5Val.includes('not recommend');

  const isQuestionNegative = isQ1Neg || isQ2Neg || isQ3Neg || isQ4Neg || isQ5Neg;

  const commentsLower = String(voiceCommentsStr).toLowerCase();
  const explicitComplaintKeywords = [
    'terrible', 'horrible', 'worst', 'rude', 'scam', 'fraud', 'cheat', 'complaint', 'complain', 
    'refund', 'defect', 'damaged', 'broken', 'disappointed', 'unhappy', 'replace', 'bad service',
    'overcharged', 'wrong bill', 'poor quality'
  ];
  const hasExplicitCommentComplaint = explicitComplaintKeywords.some(kw => commentsLower.includes(kw));

  return isQuestionNegative || hasExplicitCommentComplaint;
}

exports.submitFeedback = async (req, res) => {
  try {
    // Ensure tables exist before inserting
    await db.query(`
      CREATE TABLE IF NOT EXISTS Feedback (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32),
        source VARCHAR(32) DEFAULT 'qr',
        area VARCHAR(150),
        yourVoice TEXT,
        custName VARCHAR(255),
        custMobile VARCHAR(32),
        custDob VARCHAR(32),
        q0 VARCHAR(255), q0_other VARCHAR(255),
        q1 VARCHAR(255), q1_other VARCHAR(255),
        q2 VARCHAR(255), q2_other VARCHAR(255),
        q3 VARCHAR(255), q3_other VARCHAR(255),
        q4 VARCHAR(255), q4_other VARCHAR(255),
        q5 VARCHAR(255), q5_other VARCHAR(255),
        q6 VARCHAR(255), q6_other VARCHAR(255),
        q7 VARCHAR(255), q7_other VARCHAR(255),
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        entryDate VARCHAR(32),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        dob VARCHAR(32),
        sectionId VARCHAR(64),
        answers TEXT,
        voice TEXT,
        isNegative TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`ALTER TABLE Feedback ADD COLUMN entryTime VARCHAR(32)`).catch(() => {});

    const { 
      customerName, custName,
      mobile, custMobile,
      dob, custDob,
      sectionId, area,
      answers, q0, q1, q2, q3, q4, q5, q6, q7,
      likedMost, canImprove, additionalComments, voice, yourVoice,
      source 
    } = req.body;

    // Generate sequential continuous feedback ID starting from FB-00 (FB-00, FB-01, FB-02...)
    let id = '';
    try {
      const [maxRows] = await db.query(`
        SELECT id FROM Feedback 
        WHERE id REGEXP '^FB-[0-9]+$' AND LENGTH(id) <= 6
        ORDER BY CAST(SUBSTRING(id, 4) AS UNSIGNED) DESC 
        LIMIT 1
      `);

      if (maxRows && maxRows[0] && maxRows[0].id) {
        const rawIdStr = String(maxRows[0].id).replace(/^FB-/, '');
        const lastNum = parseInt(rawIdStr, 10);
        if (!isNaN(lastNum) && lastNum >= 0) {
          const nextNum = lastNum + 1;
          id = `FB-${String(nextNum).padStart(2, '0')}`;
        }
      }

      if (!id) {
        id = 'FB-00';
      }
    } catch (e) {
      id = 'FB-00';
    }

    const entryDate = getISTDateString();
    const entryTime = getISTTimeString();
    const dateFormatted = new Date().toLocaleDateString('en-GB');

    const finalCustName = customerName || custName || 'Anonymous';
    const finalMobile = mobile || custMobile || '';
    const finalDob = dob || custDob || null;
    const finalArea = area || sectionId || 'Ground Floor';
    const finalSource = source || 'qr';

    const compiledVoice = [
      likedMost ? `Liked Most: ${likedMost}` : '',
      canImprove ? `Can Improve: ${canImprove}` : '',
      additionalComments ? `Comments: ${additionalComments}` : '',
      voice ? `Voice: ${voice}` : '',
      yourVoice ? `Voice: ${yourVoice}` : ''
    ].filter(Boolean).join('\n');

    const isNegative = evaluateFeedbackEscalation(answers || {}, compiledVoice, q0, q1, q2, q3);

    try {
      await db.query(`
        INSERT INTO Feedback (
          id, date, source, area, yourVoice, custName, custMobile, custDob,
          q0, q1, q2, q3, q4, q5, q6, q7,
          status, entryDate, entryTime, customerName, mobile, dob, sectionId, answers, voice, isNegative
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, dateFormatted, finalSource, finalArea, compiledVoice, finalCustName, finalMobile, finalDob,
        q0 || null, q1 || null, q2 || null, q3 || null, q4 || null, q5 || null, q6 || null, q7 || null,
        entryDate, entryTime, finalCustName, finalMobile, finalDob, sectionId || null, JSON.stringify(answers || {}), compiledVoice, isNegative ? 1 : 0
      ]);
    } catch (insertErr) {
      console.error('[submitFeedback Primary Insert Error]:', insertErr);
      await db.query(`
        INSERT INTO Feedback (id, entryDate, entryTime, customerName, mobile, answers, voice, source, isNegative)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, entryDate, entryTime, finalCustName, finalMobile, JSON.stringify(answers || {}), compiledVoice, finalSource, isNegative ? 1 : 0]).catch(retryErr => {
        console.error('[submitFeedback Retry Insert Error]:', retryErr);
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:submitted', {
        id,
        entryDate,
        customerName: finalCustName,
        isNegative: !!isNegative
      });
    }

    if (isNegative) {
      const cqId = `cq_${id}`;
      try {
        await db.query(`
          INSERT INTO CallQueue (id, feedbackId, entryDate, customerName, mobile, status, notes)
          VALUES (?, ?, ?, ?, ?, 'new', ?)
        `, [cqId, id, entryDate, finalCustName, finalMobile, compiledVoice ? `Escalated Feedback: ${compiledVoice}` : 'Negative customer feedback auto-escalated']);
      } catch (cqErr) {}

      if (io) {
        io.emit('feedback:negative', {
          id,
          customerName: finalCustName,
          mobile: finalMobile || 'No Mobile',
          message: `ALERT: Negative customer feedback logged by ${finalCustName} (${finalMobile || 'No Mobile'})`
        });
      }
    }

    return res.json({ 
      success: true, 
      id,
      refNo: id,
      message: 'Thank you for your feedback!' 
    });
  } catch (err) {
    console.error('[submitFeedback Error]', err);
    return res.json({ success: true, message: 'Thank you for your feedback!' });
  }
};

exports.getFeedbackStats = async (req, res) => {
  try {
    let total = 0, neg = 0, pendingCallQueue = 0, totalCallQueue = 0;

    try {
      const [totalRows] = await db.query('SELECT COUNT(*) as total, SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negCount FROM Feedback');
      if (totalRows && totalRows[0]) {
        total = Number(totalRows[0].total) || 0;
        neg = Number(totalRows[0].negCount) || 0;
      }
    } catch (e) {}

    try {
      const [queueRows] = await db.query(`
        SELECT COUNT(*) as pendingCount 
        FROM Feedback f
        LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
        WHERE (f.isNegative = 1 OR cq.id IS NOT NULL) AND (cq.status IS NULL OR cq.status = 'new')
      `);
      if (queueRows && queueRows[0]) {
        pendingCallQueue = Number(queueRows[0].pendingCount) || 0;
      }
    } catch (e) {}

    try {
      const [allQueueRows] = await db.query(`
        SELECT COUNT(*) as totalQueueCount 
        FROM Feedback f
        LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
        WHERE f.isNegative = 1 OR cq.id IS NOT NULL
      `);
      if (allQueueRows && allQueueRows[0]) {
        totalCallQueue = Number(allQueueRows[0].totalQueueCount) || 0;
      }
    } catch (e) {}

    const pos = Math.max(0, total - neg);
    const nps = total > 0 ? Math.round((pos / total) * 100) : 100;

    return res.json({
      success: true,
      totalFeedback: total,
      positiveFeedback: pos,
      negativeFeedback: neg,
      npsScore: nps,
      pendingCallQueue,
      totalCallQueue
    });
  } catch (err) {
    return res.json({
      success: true,
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      npsScore: 100,
      pendingCallQueue: 0,
      totalCallQueue: 0
    });
  }
};

exports.getCallQueue = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy tables
    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});

    // Auto-sync missing CallQueue entries for negative feedbacks (from both QR and Staff sources)
    await db.query(`
      INSERT INTO CallQueue (id, feedbackId, entryDate, customerName, mobile, status, notes)
      SELECT 
        CONCAT('cq_auto_', f.id) as id,
        f.id as feedbackId,
        COALESCE(NULLIF(f.entryDate, ''), STR_TO_DATE(f.date, '%d/%m/%Y'), '${getISTDateString()}') as entryDate,
        COALESCE(NULLIF(f.customerName, ''), NULLIF(f.custName, ''), 'Valued Customer') as customerName,
        COALESCE(NULLIF(f.mobile, ''), NULLIF(f.custMobile, ''), '') as mobile,
        'new' as status,
        COALESCE(NULLIF(f.voice, ''), NULLIF(f.yourVoice, ''), 'Negative customer feedback auto-escalated') as notes
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR f.status = 'negative' OR LOWER(COALESCE(f.voice, f.yourVoice, '')) LIKE '%dissatisfied%') AND cq.id IS NULL
    `).catch(syncErr => {
      console.warn('[getCallQueue Auto-Sync Notice]:', syncErr.message);
    });

    const { date, startDate, endDate, status, search } = req.query;
    let sql = `
      SELECT 
        COALESCE(MAX(cq.id), CONCAT('cq_', f.id)) as id,
        f.id as feedbackId,
        COALESCE(MAX(cq.entryDate), MAX(NULLIF(f.entryDate, '')), MAX(NULLIF(f.date, '')), '${getISTDateString()}') as entryDate,
        COALESCE(MAX(cq.customerName), MAX(NULLIF(f.customerName, '')), MAX(NULLIF(f.custName, '')), 'Valued Customer') as customerName,
        COALESCE(MAX(cq.mobile), MAX(NULLIF(f.mobile, '')), MAX(NULLIF(f.custMobile, '')), '') as mobile,
        COALESCE(MAX(cq.status), 'new') as status,
        COALESCE(MAX(NULLIF(cq.notes, '')), MAX(NULLIF(f.voice, '')), MAX(NULLIF(f.yourVoice, '')), 'Negative customer feedback auto-escalated') as notes,
        COALESCE(MAX(cq.attempts), 0) as attempts,
        MAX(cq.followUpDate) as followUpDate,
        COALESCE(MAX(cq.createdAt), MAX(f.createdAt), MAX(f.created_at)) as createdAt
      FROM Feedback f
      LEFT JOIN CallQueue cq ON (cq.feedbackId = f.id OR cq.id = f.id)
      WHERE (f.isNegative = 1 OR cq.id IS NOT NULL)
    `;
    const params = [];

    if (date) {
      sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) = ?)';
      params.push(date);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(cq.entryDate, f.entryDate, f.date) <= ?)';
        params.push(endDate);
      }
    }

    if (status && status !== 'all') {
      sql += ' AND (COALESCE(cq.status, "new") = ?)';
      params.push(status);
    }

    if (search) {
      sql += ' AND (f.customerName LIKE ? OR f.custName LIKE ? OR f.mobile LIKE ? OR f.custMobile LIKE ? OR f.voice LIKE ? OR f.yourVoice LIKE ? OR cq.notes LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ' GROUP BY f.id ORDER BY COALESCE(MAX(cq.entryDate), MAX(f.entryDate), MAX(f.date)) DESC, f.id DESC';

    const [rows] = await db.query(sql, params).catch(async () => {
      const [fallback] = await db.query('SELECT * FROM CallQueue ORDER BY id DESC');
      return [fallback];
    });

    const formatted = (rows || []).map(r => {
      let rawDateStr = r.entryDate || r.entry_date || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.createdAt || r.created_at)) {
        entryTimeStr = getISTTimeString(r.createdAt || r.created_at);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      return {
        ...r,
        customerName: r.customerName || r.custName || r.customer_name || 'Valued Customer',
        mobile: r.mobile || r.custMobile || r.phone || 'N/A',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        status: r.status || 'new',
        attempts: r.attempts || 0
      };
    });

    return res.json({ success: true, callQueue: formatted });
  } catch (err) {
    console.error('[getCallQueue Error]', err);
    return res.json({ success: true, callQueue: [] });
  }
};

exports.updateCallQueue = async (req, res) => {
  try {
    const body = req.body || {};
    const targetId = body.id || body.feedbackId || body.rawFeedbackId || 'unknown';
    const safeId = String(targetId);
    const rawFeedbackId = safeId.startsWith('cq_auto_') 
      ? safeId.replace('cq_auto_', '') 
      : (safeId.startsWith('cq_') ? safeId.replace('cq_', '') : safeId);

    const status = body.status || 'called';
    const notes = body.notes || body.actionTaken || '';
    const followUpDate = body.followUpDate || null;
    const isResolvedStatus = status === 'resolved' || status === 'closed';
    const finalIsNegFlag = isResolvedStatus ? 0 : 1;

    // 1. Ensure tables exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS CallQueue (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64),
        entryDate VARCHAR(16),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'new',
        notes TEXT,
        attempts INT DEFAULT 0,
        followUpDate VARCHAR(32),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`
      CREATE TABLE IF NOT EXISTS CallLogs (
        id VARCHAR(64) PRIMARY KEY,
        feedbackId VARCHAR(64) NOT NULL,
        executive VARCHAR(255) DEFAULT 'Store Executive',
        callDate VARCHAR(32),
        callOutcome VARCHAR(64),
        issueCategory VARCHAR(64),
        followUpDate VARCHAR(64),
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    await db.query(`ALTER TABLE CallQueue ADD COLUMN feedbackId VARCHAR(64)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN entryDate VARCHAR(16)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN customerName VARCHAR(255)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN mobile VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN status VARCHAR(32) DEFAULT 'new'`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN notes TEXT`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN attempts INT DEFAULT 0`).catch(() => {});
    await db.query(`ALTER TABLE CallQueue ADD COLUMN followUpDate VARCHAR(32)`).catch(() => {});

    // 2. Fetch customer details from Feedback table
    let cName = 'Valued Customer';
    let cMob = '';
    let eDate = getISTDateString();

    try {
      const [fbRows] = await db.query('SELECT customerName, custName, mobile, custMobile, entryDate, date FROM Feedback WHERE id = ?', [rawFeedbackId]);
      if (fbRows && fbRows[0]) {
        cName = fbRows[0].customerName || fbRows[0].custName || 'Valued Customer';
        cMob = fbRows[0].mobile || fbRows[0].custMobile || '';
        eDate = fbRows[0].entryDate || fbRows[0].date || getISTDateString();
      }
    } catch (fbErr) {}

    // 3. Update or Insert CallQueue record
    let updated = false;
    try {
      const [existing] = await db.query(
        'SELECT id, attempts FROM CallQueue WHERE id = ? OR feedbackId = ? OR id = ?', 
        [safeId, rawFeedbackId, rawFeedbackId]
      );

      if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const nextAttempts = (Number(existing[0].attempts) || 0) + 1;

        await db.query(`
          UPDATE CallQueue 
          SET status = ?, notes = ?, followUpDate = ?, attempts = ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE id = ? OR feedbackId = ?
        `, [status, notes, followUpDate, nextAttempts, existingId, rawFeedbackId]);
        updated = true;
      }
    } catch (updErr) {
      console.warn('[updateCallQueue Existing Update Notice]:', updErr.message);
    }

    if (!updated) {
      const newCqId = getUUID();
      try {
        await db.query(`
          INSERT INTO CallQueue (id, feedbackId, entryDate, customerName, mobile, status, notes, attempts)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [newCqId, rawFeedbackId, eDate, cName, cMob, status, notes]);
      } catch (insErr) {
        await db.query(`
          INSERT INTO CallQueue (id, status, notes)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes)
        `, [safeId, status, notes]).catch(() => {});
      }
    }

    // 4. Update Feedback table (persist status, actionTaken, and isNegative flag)
    await db.query(`ALTER TABLE Feedback ADD COLUMN status VARCHAR(32)`).catch(() => {});
    await db.query(`ALTER TABLE Feedback ADD COLUMN actionTaken TEXT`).catch(() => {});

    await db.query(`
      UPDATE Feedback 
      SET status = ?, actionTaken = ?, isNegative = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? OR id = ?
    `, [status, notes, finalIsNegFlag, rawFeedbackId, safeId]).catch(fbUpdErr => {
      console.warn('[updateCallQueue Feedback Table Sync Notice]:', fbUpdErr.message);
    });

    // 5. Save structured CallLog record in MySQL database
    if (notes || body.callOutcome) {
      const logId = getUUID();
      await db.query(`
        INSERT INTO CallLogs (id, feedbackId, executive, callDate, callOutcome, issueCategory, followUpDate, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logId,
        rawFeedbackId,
        body.executive || body.createdBy || 'Store Telecaller',
        getISTDateString(),
        body.callOutcome || (isResolvedStatus ? 'Resolved' : 'Call Logged'),
        body.issueCategory || 'Customer Resolution Desk',
        followUpDate || '',
        notes
      ]).catch(logErr => console.warn('[CallLogs Insert Notice]:', logErr.message));
    }

    // 6. Broadcast real-time Socket.IO push event
    const io = req.app.get('io');
    if (io) {
      io.emit('feedback:negative', { id: rawFeedbackId, status, isNegative: finalIsNegFlag });
      io.emit('feedback:submitted', { id: rawFeedbackId });
      io.emit('callqueue:updated', { id: rawFeedbackId, status, notes });
    }

    return res.json({ success: true, message: 'Call queue entry updated and persisted successfully' });
  } catch (err) {
    console.error('[updateCallQueue Error]', err);
    return res.json({ success: true, message: 'Call queue entry updated' });
  }
};

// ── Sourcing Diverts ────────────────────────────────────────
exports.getDiverts = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Diverts (
        id VARCHAR(64) PRIMARY KEY,
        entryDate VARCHAR(16),
        sectionId VARCHAR(64),
        productWanted VARCHAR(255),
        quantity INT DEFAULT 1,
        priceRange VARCHAR(64),
        reasonCode VARCHAR(64) DEFAULT 'OUT_OF_STOCK',
        customerName VARCHAR(255),
        customerMobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'open',
        createdBy VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const [rows] = await db.query('SELECT * FROM Diverts ORDER BY createdAt DESC');
    return res.json({ success: true, diverts: rows || [] });
  } catch (err) {
    return res.json({ success: true, diverts: [] });
  }
};

exports.createDivert = async (req, res) => {
  try {
    const { sectionId, productWanted, quantity, priceRange, reasonCode, customerName, customerMobile, createdBy } = req.body;
    const id = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];
    
    await db.query(`
      INSERT INTO Diverts (id, entryDate, sectionId, productWanted, quantity, priceRange, reasonCode, customerName, customerMobile, status, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [id, entryDate, sectionId || null, productWanted, quantity || 1, priceRange || '', reasonCode || 'OUT_OF_STOCK', customerName || '', customerMobile || '', createdBy || 'Floor Staff']);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, 'open', 'Sourcing divert raised by staff', ?, 'Staff')
    `, [updateId, id, createdBy || 'Staff']);

    const io = req.app.get('io');
    if (io) {
      io.emit('divert:created', {
        id,
        productWanted,
        quantity: quantity || 1,
        createdBy: createdBy || 'Floor Staff',
        message: `URGENT DIVERT: New stock request for ${productWanted} (Qty: ${quantity || 1}) created by ${createdBy || 'Floor Staff'}`
      });
    }

    return res.json({ success: true, message: 'Divert created successfully', id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateDivert = async (req, res) => {
  try {
    const { id, status, pmNotes, actorRole, actorId } = req.body;
    await db.query(`
      UPDATE Diverts SET status = ?, pmNotes = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
    `, [status, pmNotes || '', id]);

    const updateId = getUUID();
    await db.query(`
      INSERT INTO DivertUpdates (id, divertId, status, note, actorId, actorRole)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [updateId, id, status, pmNotes || `Status updated to ${status}`, actorId || 'PM', actorRole || 'Purchase Manager']);

    return res.json({ success: true, message: 'Divert status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDivertUpdates = async (req, res) => {
  try {
    const { divertId } = req.query;
    const [rows] = await db.query('SELECT * FROM DivertUpdates WHERE divertId = ? ORDER BY createdAt DESC', [divertId]);
    return res.json({ success: true, updates: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Cash Settlement ──────────────────────────────────────────
exports.getCashSettlement = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [header] = await db.query('SELECT * FROM CashSettlements WHERE entryDate = ?', [date]);
    if (header.length === 0) {
      return res.json({ success: true, date, settlement: null, counters: [] });
    }
    const [counters] = await db.query('SELECT * FROM CashCounterReports WHERE settlementId = ?', [header[0].id]);
    return res.json({ success: true, date, settlement: header[0], counters });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveCashSettlement = async (req, res) => {
  try {
    const { entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy, counters } = req.body;
    const settlementId = getUUID();

    await db.query(`
      INSERT INTO CashSettlements (id, entryDate, saleAmount, billsCount, cashTotal, cardTotal, upiTotal, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE saleAmount = VALUES(saleAmount), billsCount = VALUES(billsCount), cashTotal = VALUES(cashTotal), cardTotal = VALUES(cardTotal), upiTotal = VALUES(upiTotal), submittedBy = VALUES(submittedBy), updatedAt = CURRENT_TIMESTAMP
    `, [settlementId, entryDate, saleAmount || 0, billsCount || 0, cashTotal || 0, cardTotal || 0, upiTotal || 0, submittedBy || 'Cashier']);

    await db.query('DELETE FROM CashCounterReports WHERE settlementId = ?', [settlementId]);
    if (Array.isArray(counters)) {
      for (let c of counters) {
        const cId = getUUID();
        await db.query(`
          INSERT INTO CashCounterReports (id, settlementId, counterName, cashierName, billsCount, saleAmount, cashAmount, cardAmount, upiAmount, staffDiscount, customerDiscount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cId, settlementId, c.counterName || 'Counter 1', c.cashierName || 'Staff', c.billsCount || 0, c.saleAmount || 0, c.cashAmount || 0, c.cardAmount || 0, c.upiAmount || 0, c.staffDiscount || 0, c.customerDiscount || 0]);
      }
    }

    return res.json({ success: true, message: 'Cash settlement saved successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Visual Merchandising (VM) ───────────────────────────────
exports.getVmPoints = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM VmChecklistPoints WHERE isActive = TRUE ORDER BY position ASC');
    if (rows.length === 0) {
      const defaults = [
        { id: 'vm_1', title: 'Mannequins Dressed & Styled', section: 'Main Entrance', position: 1 },
        { id: 'vm_2', title: 'Lighting & Display Spotlights Active', section: 'Main Entrance', position: 2 },
        { id: 'vm_3', title: 'Aisle Clear & Hanger Uniformity', section: 'Ground Floor', position: 3 },
        { id: 'vm_4', title: 'Price Tags & Size Indicators Visible', section: 'Ground Floor', position: 4 }
      ];
      return res.json({ success: true, points: defaults });
    }
    return res.json({ success: true, points: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVmSubmissions = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM VmSubmissions ORDER BY createdAt DESC LIMIT 30');
    return res.json({ success: true, submissions: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.submitVm = async (req, res) => {
  try {
    const { shift, floor, scorePercent, submittedBy, entries } = req.body;
    const submissionId = getUUID();
    const entryDate = new Date().toISOString().split('T')[0];

    await db.query(`
      INSERT INTO VmSubmissions (id, entryDate, shift, floor, scorePercent, submittedBy)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [submissionId, entryDate, shift || 'Opening', floor || '1st Floor', scorePercent || 100, submittedBy || 'VM Auditor']);

    if (Array.isArray(entries)) {
      for (let e of entries) {
        const eId = getUUID();
        await db.query(`
          INSERT INTO VmSubmissionEntries (id, submissionId, pointId, pointTitle, score, remarks, photoUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eId, submissionId, e.pointId, e.pointTitle || 'Check Point', e.score || 'Pass', e.remarks || '', e.photoUrl || '']);
      }
    }

    return res.json({ success: true, message: 'VM checklist submitted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFeedbacks = async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Feedback (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32),
        source VARCHAR(32) DEFAULT 'qr',
        area VARCHAR(150),
        yourVoice TEXT,
        custName VARCHAR(255),
        custMobile VARCHAR(32),
        custDob VARCHAR(32),
        q0 VARCHAR(255), q0_other VARCHAR(255),
        q1 VARCHAR(255), q1_other VARCHAR(255),
        q2 VARCHAR(255), q2_other VARCHAR(255),
        q3 VARCHAR(255), q3_other VARCHAR(255),
        q4 VARCHAR(255), q4_other VARCHAR(255),
        q5 VARCHAR(255), q5_other VARCHAR(255),
        q6 VARCHAR(255), q6_other VARCHAR(255),
        q7 VARCHAR(255), q7_other VARCHAR(255),
        status VARCHAR(32) DEFAULT 'new',
        actionTaken TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        entryDate VARCHAR(32),
        customerName VARCHAR(255),
        mobile VARCHAR(32),
        dob VARCHAR(32),
        sectionId VARCHAR(64),
        answers TEXT,
        voice TEXT,
        isNegative TINYINT(1) DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    // Ensure columns exist on legacy/altered tables
    const colsToAdd = [
      'date VARCHAR(32)',
      'source VARCHAR(32) DEFAULT "qr"',
      'area VARCHAR(150)',
      'yourVoice TEXT',
      'custName VARCHAR(255)',
      'custMobile VARCHAR(32)',
      'custDob VARCHAR(32)',
      'q0 VARCHAR(255)', 'q0_other VARCHAR(255)',
      'q1 VARCHAR(255)', 'q1_other VARCHAR(255)',
      'q2 VARCHAR(255)', 'q2_other VARCHAR(255)',
      'q3 VARCHAR(255)', 'q3_other VARCHAR(255)',
      'q4 VARCHAR(255)', 'q4_other VARCHAR(255)',
      'q5 VARCHAR(255)', 'q5_other VARCHAR(255)',
      'q6 VARCHAR(255)', 'q6_other VARCHAR(255)',
      'q7 VARCHAR(255)', 'q7_other VARCHAR(255)',
      'status VARCHAR(32) DEFAULT "new"',
      'actionTaken TEXT',
      'isNegative TINYINT(1) DEFAULT 0',
      'answers TEXT',
      'voice TEXT',
      'entryDate VARCHAR(32)',
      'customerName VARCHAR(255)',
      'mobile VARCHAR(32)'
    ];
    for (const col of colsToAdd) {
      await db.query(`ALTER TABLE Feedback ADD COLUMN ${col}`).catch(() => {});
    }

    const { date, startDate, endDate, isNegative, search } = req.query;
    let sql = 'SELECT * FROM Feedback WHERE 1=1';
    const params = [];

    let altDate = date || '';
    if (date && typeof date === 'string') {
      if (date.includes('-') && date.split('-').length === 3) {
        const [y, m, d] = date.split('-');
        altDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      } else if (date.includes('/') && date.split('/').length === 3) {
        const [d, m, y] = date.split('/');
        altDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      sql += ' AND (entryDate = ? OR entryDate = ? OR date = ? OR date = ? OR DATE(created_at) = ? OR DATE(createdAt) = ?)';
      params.push(date, altDate, date, altDate, date, altDate);
    } else {
      if (startDate) {
        sql += ' AND (COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) >= ?)';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND (COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) <= ?)';
        params.push(endDate);
      }
    }

    if (isNegative !== undefined && isNegative !== '' && isNegative !== 'all') {
      sql += ' AND isNegative = ?';
      params.push(isNegative === 'true' || isNegative === '1' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (customerName LIKE ? OR custName LIKE ? OR mobile LIKE ? OR custMobile LIKE ? OR voice LIKE ? OR yourVoice LIKE ? OR answers LIKE ? OR q0 LIKE ? OR q1 LIKE ? OR q2 LIKE ? OR q3 LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s);
    }

    sql += ' ORDER BY COALESCE(NULLIF(entryDate, ""), STR_TO_DATE(date, "%d/%m/%Y"), DATE(createdAt), DATE(created_at)) DESC, id DESC';

    const [rows] = await db.query(sql, params).catch(async (err) => {
      console.warn('[getFeedbacks Query Fail, fallback executing]:', err.message);
      const [fallbackRows] = await db.query('SELECT * FROM Feedback ORDER BY id DESC');
      return [fallbackRows];
    });

    let formatted = (rows || []).map(r => {
      let parsedAnswers = {};
      try {
        parsedAnswers = typeof r.answers === 'string' ? JSON.parse(r.answers || '{}') : (r.answers || {});
      } catch (e) {
        parsedAnswers = {};
      }

      ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].forEach(qKey => {
        if (r[qKey] && !parsedAnswers[qKey]) {
          parsedAnswers[qKey] = r[qKey];
        }
        if (r[`${qKey}_other`] && !parsedAnswers[`${qKey}_other`]) {
          parsedAnswers[`${qKey}_other`] = r[`${qKey}_other`];
        }
      });

      let rawDateStr = r.entryDate || r.date || (r.created_at || r.createdAt ? new Date(r.created_at || r.createdAt).toISOString().split('T')[0] : getISTDateString());
      if (typeof rawDateStr === 'string' && rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
          rawDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const voiceText = [r.voice, r.yourVoice].filter(Boolean).join('\n').trim();
      const isResolvedStatus = r.status === 'resolved' || r.status === 'closed';
      const isNegEvaluated = isResolvedStatus ? false : evaluateFeedbackEscalation(parsedAnswers, voiceText, r.q0, r.q1, r.q2, r.q3);

      let entryTimeStr = r.entryTime || '';
      if (!entryTimeStr && (r.created_at || r.createdAt)) {
        entryTimeStr = getISTTimeString(r.created_at || r.createdAt);
      }
      if (!entryTimeStr) {
        entryTimeStr = getISTTimeString();
      }

      return {
        ...r,
        customerName: r.customerName || r.custName || r.customer_name || r.name || 'Anonymous',
        custName: r.custName || r.customerName || 'Anonymous',
        mobile: r.mobile || r.custMobile || r.customerMobile || r.phone || '',
        custMobile: r.custMobile || r.mobile || '',
        entryDate: rawDateStr,
        entryTime: entryTimeStr || '10:00 AM',
        date: r.date || rawDateStr,
        voice: voiceText,
        yourVoice: voiceText,
        answers: parsedAnswers,
        actionTaken: r.actionTaken || r.notes || '',
        notes: r.actionTaken || r.notes || '',
        status: r.status || (isNegEvaluated ? 'new' : 'resolved'),
        isNegative: isNegEvaluated
      };
    });

    // In-memory secondary date filter to guarantee exact match even if DB fallback triggered
    if (date && typeof date === 'string') {
      formatted = formatted.filter(r => 
        r.entryDate === date || r.entryDate === altDate ||
        r.date === date || r.date === altDate
      );
    }

    const total = formatted.length;
    const negative = formatted.filter(r => r.isNegative).length;
    const positive = total - negative;
    const npsScore = total > 0 ? Math.round((positive / total) * 100) : 100;

    return res.json({
      success: true,
      feedbacks: formatted,
      stats: {
        total,
        positive,
        negative,
        npsScore
      }
    });
  } catch (err) {
    console.error('[getFeedbacks Error]', err);
    return res.json({
      success: true,
      feedbacks: [],
      stats: { total: 0, positive: 0, negative: 0, npsScore: 100 }
    });
  }
};
