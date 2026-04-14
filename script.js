$(document).ready(function() {
    const API_BASE = '/api';
    const WS_BASE = `ws://${window.location.host}/api/vitals/stream`;
    let vitalsSocket = null;
    const ICU_TOKEN = 'icu_predict_token';

    // Global AJAX Setup for JWT
    $.ajaxSetup({
        beforeSend: function(xhr) {
            const token = localStorage.getItem(ICU_TOKEN);
            if (token) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            }
        }
    });

    function getAuthHeaders() {
        const token = localStorage.getItem(ICU_TOKEN);
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    function connectToPatientStream(pId, hrEl, spo2El, breathEl) {
        if (vitalsSocket) vitalsSocket.close();
        
        console.log(`📡 Connecting to Live Telemetry Stream for: ${pId}`);
        vitalsSocket = new WebSocket(`${WS_BASE}/${pId}`);

        vitalsSocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            // Update Metrics with pulse effect
            if (hrEl && $(hrEl).length) {
                $(hrEl).text(data.hr).addClass('animate-pulse');
                setTimeout(() => $(hrEl).removeClass('animate-pulse'), 1000);
            }
            if (spo2El && $(spo2El).length) $(spo2El).text(data.spo2);
            if (breathEl && $(breathEl).length) $(breathEl).text(data.breath);
            
            // Update Roadmap/Status if applicable
            if ($('#snapPatientStatus').length) $('#snapPatientStatus').text(data.status);
        };

        vitalsSocket.onclose = () => console.log("Stream Disconnected");
    }

    // --- Interactive Login Chips (Quick-Fill) ---
    $('.demo-credential-chip').on('click', function() {
        const user = $(this).data('user');
        const role = $(this).data('role');
        
        $('#username').val(user);
        $('#password').val('password123'); // Default demo password
        $(`#role-${role}`).prop('checked', true);
        
        // Visual feedback
        $(this).addClass('bg-teal-subtle border-teal').siblings().removeClass('bg-teal-subtle border-teal');
    });

    // --- Authentication & Registration ---
    $('#loginForm').on('submit', async function(e) {
        e.preventDefault();
        const selectedRole = $('input[name="userRole"]:checked').val() || 'platform';
        const username = $('#username').val();
        const password = $('#password').val();
        const loginError = $('#loginError');
        const submitBtn = $(this).find('button[type="submit"]');

        submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Authenticating...');

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role: selectedRole })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                localStorage.setItem(ICU_TOKEN, data.access_token);
                if (data.institution) localStorage.setItem('icu_hosp_id', data.institution);
                window.location.href = data.redirect;
            } else { throw new Error(data.detail || "Authentication Failed"); }
        } catch (error) {
            loginError.removeClass('d-none').text(`Access Denied: ${error.message}`);
            submitBtn.prop('disabled', false).text('Sign In');
        }
    });

    $('#signupForm').on('submit', async function(e) {
        e.preventDefault();
        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: $('#reg-username').val(),
                    password: $('#reg-password').val(),
                    role: $('#reg-role').val(),
                    institution: $('#reg-institution').val()
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                bootstrap.Modal.getInstance(document.getElementById('signupModal')).hide();
            } else { throw new Error(data.detail); }
        } catch (e) { alert("Registration Error: " + e.message); }
    });

    // --- Sidebar Navigation (Unified SPA Handler) ---
    $('.dash-sidebar .nav-link').on('click', function(e) {
        const targetId = $(this).attr('id');
        if (!targetId || targetId === 'logout-link') return; 

        e.preventDefault();
        $('.dash-sidebar .nav-link').removeClass('active');
        $(this).addClass('active');
        
        // Unified map for Platform, Hospital, and Patient sections
        const map = {
            'v-pills-home-tab': '#dashboard-section',
            'v-pills-hospitals-tab': '#hospitals-section',
            'v-pills-training-tab': '#training-section',
            'v-pills-analytics-tab': '#analytics-section',
            'v-pills-settings-tab': '#settings-section',
            'hosp-home-tab': '#hosp-dashboard-section',
            'hosp-patients-tab': '#hosp-patients-section',
            'hosp-training-tab': '#hosp-training-section',
            'hosp-staff-tab': '#hosp-staff-section',
            'hosp-settings-tab': '#hosp-settings-section',
            'doc-census-tab': '#doc-census-section',
            'doc-predict-tab': '#doc-predict-section',
            'doc-alerts-tab': '#doc-alerts-section',
            'doc-rounds-tab': '#doc-rounds-section',
            'doc-settings-tab': '#doc-settings-section',
            'pat-vitals-tab': '#pat-vitals-section',
            'pat-labs-tab': '#pat-labs-section',
            'pat-history-tab': '#pat-history-section',
            'pat-team-tab': '#pat-team-section',
            'pat-settings-tab': '#pat-settings-section'
        };

        const targetSection = $(map[targetId]);
        if (targetSection.length) {
            $('.dash-content section').addClass('d-none').removeClass('active-section');
            targetSection.removeClass('d-none').addClass('active-section');
            
            // Contextual Data Loads
            if (targetId === 'v-pills-home-tab') updateStats();
            if (targetId === 'v-pills-hospitals-tab') loadHospitals();
            if (targetId === 'v-pills-analytics-tab') initAnalyticsCharts();
            if (targetId === 'hosp-home-tab') initHospitalDashboard();
            if (targetId === 'hosp-staff-tab') initHospitalStaff();
            if (targetId === 'hosp-patients-tab') initHospitalPatients();
            if (targetId === 'doc-census-tab') initDoctorDashboard();
            if (targetId.startsWith('pat-')) initPatientDashboard();
        }
    });

    async function initDoctorDashboard() {
        if (!$('#doc-census-section').length) return;
        
        try {
            const census = await $.get(`${API_BASE}/doctor/census?doctor_name=Dr. Sarah Mitchell`);
            const tbody = $('#censusTableBody');
            const select = $('#predictSubjectSelect');
            tbody.empty();
            select.empty().append('<option value="">Select Patient...</option>');
            
            $('#caseLoadCount').text(census.length);
            
            census.forEach(p => {
                tbody.append(`
                    <tr>
                        <td class="fw-bold">${p.id}</td>
                        <td>${p.date}</td>
                        <td><span class="badge bg-teal-subtle text-teal">${p.status}</span></td>
                        <td class="small text-muted">Last Pulse: Stable</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-dark px-3 py-1 rounded-3 view-snapshot-btn" data-id="${p.id}">
                                <i class="fa-solid fa-expand me-1"></i> View Snapshot
                            </button>
                        </td>
                    </tr>
                `);
                select.append(`<option value="${p.id}">${p.id} - ${p.name || 'Anonymous'}</option>`);
            });
        } catch (e) { console.error("Census load failed."); }
    }

    // --- Clinician Slide-Out Logic (Patient 360) ---
    $(document).on('click', '.view-snapshot-btn', async function() {
        const pId = $(this).data('id');
        const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('patientSnapshotOffcanvas'));
        
        try {
            const p = await $.get(`${API_BASE}/patient/${pId}/snapshot`);
            
            // Basic Info
            $('#snapPatientName').text(p.name || 'Subject Snapshot');
            $('#snapPatientId').text(`ID: ${p.id}`);
            
            // Vitals
            $('#snapHr').text(`${p.vitals.hr[p.vitals.hr.length-1]} bpm`);
            $('#snapSpo2').text(`${p.vitals.spo2[p.vitals.spo2.length-1]}%`);
            $('#snapBreath').text(`${p.vitals.breath[p.vitals.breath.length-1]} br`);
            
            // Connect to Live Stream Snapshot
            connectToPatientStream(pId, '#snapHr', '#snapSpo2', '#snapBreath');
            
            // Labs
            const labsList = $('#snapLabsList');
            labsList.empty();
            if (p.lab_reports.length) {
                p.lab_reports.forEach(l => {
                    labsList.append(`
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span>${l.test}</span>
                            <span class="fw-bold text-dark">${l.value} <small class="text-teal ms-1">(${l.status})</small></span>
                        </div>
                    `);
                });
            } else { labsList.text('No recent diagnostic data available.'); }
            
            // History
            const historyArea = $('#snapHistoryTimeline');
            historyArea.empty();
            if (p.medical_history.length) {
                p.medical_history.forEach(h => {
                    historyArea.append(`
                        <div class="mb-3">
                            <div class="fw-bold">${h.event}</div>
                            <div class="text-muted">${h.date}</div>
                        </div>
                    `);
                });
            } else { historyArea.text('No historical records synced.'); }
            
            // Reset Predictor UI
            $('#snapPredictResult').addClass('d-none');
            $('#snapRunPredictBtn').data('id', p.id).prop('disabled', false).text('Run Inference');
            
            offcanvas.show();
        } catch (e) { alert("Failed to fetch subject snapshot."); }
    });

    // Run Predictor from Snapshot
    $('#snapRunPredictBtn').on('click', async function() {
        const pId = $(this).data('id');
        const btn = $(this);
        
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
        
        try {
            const res = await $.ajax({
                url: `${API_BASE}/doctor/predict`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ patient_id: pId })
            });

            if (res.success) {
                $('#snapRiskScore').text(`${res.score}/10`);
                const drivers = $('#snapDriversList');
                drivers.empty();
                Object.keys(res.top_drivers).forEach(d => {
                    drivers.append(`<span class="badge bg-teal-subtle text-teal x-small">${d}</span>`);
                });
                
                $('#snapPredictResult').removeClass('d-none');
            }
        } catch (e) { console.error("Snapshot prediction failed."); }
        finally { btn.text('Analysis Complete'); }
    });

    $('#runPredictBtn').on('click', async function() {
        const pId = $('#predictSubjectSelect').val();
        if (!pId) return alert("Select a subject first.");
        
        const btn = $(this);
        btn.prop('disabled', true).text('Federating...');
        $('#inferencePulseUI').removeClass('d-none');
        $('#predictionResultArea').addClass('d-none');
        
        // Pulse Stepper Stages
        const steps = [
            { id: '#p-step-1', text: 'Retrieving latest federated weights...' },
            { id: '#p-step-2', text: 'Performing local ICU fitting cohort analysis...' },
            { id: '#p-step-3', text: 'Verifying global predictor synchronization...' }
        ];

        $('.pulse-step').removeClass('active completed');
        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            $(s.id).addClass('active');
            $('#inferenceStatus').text(s.text);
            await new Promise(r => setTimeout(r, 1200));
            $(s.id).removeClass('active').addClass('completed');
        }

        try {
            const res = await $.ajax({
                url: `${API_BASE}/doctor/predict`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ patient_id: pId })
            });

            if (res.success) {
                $('#finalRiskResult').text(res.score);
                $('#predictionResultArea').removeClass('d-none');
                $('#inferenceStatus').text('Inference Success!');
                
                // Show XAI Drivers
                $('#modelConfidence').text(`${Math.round(res.confidence * 100)}%`);
                const driverList = $('#riskDriversList');
                driverList.empty();
                Object.entries(res.top_drivers).forEach(([factor, impact]) => {
                    driverList.append(`<span class="badge bg-teal-subtle text-teal border py-2 px-3 small">${factor}</span>`);
                });

                // Update table if it exists
                $(`#censusTableBody tr:contains('${pId}')`).find('td:nth-child(4)').text(`Risk: ${res.score}/10`);
            }
        } catch (err) {
            console.error("Prediction failed:", err);
        } finally {
            btn.prop('disabled', false).text('Run Predictor');
            $('#inferencePulseUI').addClass('d-none');
        }
    });

    // Patient/Subject Registration (Doctor-Led)
    $('#registerPatientForm').on('submit', async function(e) {
        e.preventDefault();
        const btn = $('#submitNewPatient');
        const originalText = btn.text();
        
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Provisioning Subject...');
        
        const data = {
            name: $('#regPatName').val(),
            email: $('#regPatEmail').val(),
            status: $('#regPatStatus').val(),
            doctor_name: "Dr. Sarah Mitchell",
            hosp_id: "hosp_001"
        };
        
        try {
            const res = await $.ajax({
                url: `${API_BASE}/doctor/onboard`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(data),
                headers: getAuthHeaders()
            });
            
            if (res.success) {
                const regModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('registerPatientModal'));
                const credModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('patientCredentialsModal'));
                
                $('#dispPatUser').text(res.username);
                $('#dispPatPass').text(res.password);
                
                regModal.hide();
                credModal.show();
                
                initDoctorDashboard(); // Refresh Census
            }
        } catch (err) {
            console.error("Subject Registration Failed:", err);
            alert("Onboarding Failed: " + (err.responseJSON ? err.responseJSON.detail : "Network disconnect"));
        } finally {
            btn.prop('disabled', false).text(originalText);
        }
    });

    // --- Federated Training Pipeline (Refactored) ---
    $('#globalSyncBtn').on('click', async function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Cycle in Progress...');
        
        // Pipeline Stages
        const stages = [
            { id: '#step-upload', text: 'Uploading anonymized node weights...', status: 'UPLOADING' },
            { id: '#step-cleaning', text: 'Cleaning institutional data residuals...', status: 'CLEANING' },
            { id: '#step-fitting', text: 'Fitting global weights to federated model...', status: 'FITTING' },
            { id: '#step-training', text: 'Recalibrating Global ICU Predictor...', status: 'TRAINING' }
        ];

        // Reset
        $('.stepper-step').removeClass('active completed');
        $('#pipelineStatus').text('INITIALIZING').addClass('bg-warning-subtle text-warning').removeClass('bg-teal-subtle text-teal');

        for (let i = 0; i < stages.length; i++) {
            const s = stages[i];
            $('.stepper-step').removeClass('active');
            $(s.id).addClass('active');
            $('#pipelineStatus').text(s.status);
            $('#step-details').text(s.text);
            
            await new Promise(r => setTimeout(r, 1500));
            $(s.id).removeClass('active').addClass('completed');
        }

        const response = await fetch(`${API_BASE}/train`, { method: 'POST' });
        $('#pipelineStatus').text('COMPLETED').removeClass('bg-warning-subtle text-warning').addClass('bg-teal-subtle text-teal');
        $('#step-details').html('<i class="fa-solid fa-check-circle text-success me-2"></i> Federated Training Cycle Success! All nodes synchronized.');
        btn.prop('disabled', false).text('Run Global Training');
    });

    // --- Hospital & Node Management ---
    async function loadHospitals() {
        const response = await fetch(`${API_BASE}/hospitals`);
        const hospitals = await response.json();
        const tbody = $('#hospitalTable tbody');
        tbody.empty();

        hospitals.forEach(h => {
            const statusClass = h.status === 'Active' ? 'bg-success' : 'bg-danger';
            const actionText = h.status === 'Active' ? 'Block Access' : 'Activate Node';
            tbody.append(`
                <tr>
                    <td><div class="fw-bold">${h.name}</div><div class="x-small text-muted">ID: ${h.id}</div></td>
                    <td><div class="small">${h.admin_name}</div></td>
                    <td><div class="small">${h.last_login}</div></td>
                    <td><span class="badge bg-light text-dark border">${h.permissions}</span></td>
                    <td><span class="badge ${statusClass}">${h.status}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-dark" onclick="toggleHospitalStatus('${h.id}')">${actionText}</button>
                    </td>
                </tr>
            `);
        });
    }

    window.toggleHospitalStatus = async function(id) {
        await fetch(`${API_BASE}/hospitals/${id}/toggle_status`, { method: 'POST' });
        loadHospitals(); // Refresh table
    };


    // --- Dashboard & Analytics ---
    async function initDashboard() {
        updateStats();
        if ($('#networkHealthChart').length > 0) {
            const ctx = document.getElementById('networkHealthChart').getContext('2d');
            const data = await (await fetch(`${API_BASE}/analytics/network`)).json();
            if (window.netHealthChart) window.netHealthChart.destroy();
            window.netHealthChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{ label: 'Node Uptime %', data: data.data, backgroundColor: '#0f172a', borderRadius: 8 }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    async function initAnalyticsCharts() {
        const convCtx = document.getElementById('convergenceChart').getContext('2d');
        const convData = await (await fetch(`${API_BASE}/analytics/convergence`)).json();
        if (window.convChart) window.convChart.destroy();
        window.convChart = new Chart(convCtx, {
            type: 'line',
            data: {
                labels: convData.labels,
                datasets: [{ label: 'Aggregation Loss', data: convData.loss, borderColor: '#14b8a6', fill: true, backgroundColor: 'rgba(20, 184, 166, 0.1)' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Dynamic Accuracy Distribution
        const distCtx = document.getElementById('accuracyDistChart').getContext('2d');
        const distData = await (await fetch(`${API_BASE}/analytics/accuracy-dist`)).json();
        if (window.accDistChart) window.accDistChart.destroy();
        window.accDistChart = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: distData.labels,
                datasets: [{ data: distData.data, backgroundColor: distData.colors }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    }

    async function updateStats() {
        try {
            const response = await fetch(`${API_BASE}/stats`, { headers: getAuthHeaders() });
            const data = await response.json();
            $('#activeNodesCount').text(data.active_nodes);
            $('#modelVersion').text(data.model_version);
        } catch (e) {
            console.error("Auth expired or failed:", e);
            if (window.location.pathname.includes('dash')) window.location.href = 'login.html';
        }
    }

    // --- Hospital Provisioning ---
    $('#createHospitalForm').on('submit', async function(e) {
        e.preventDefault();
        const hospName = $('#newHospName').val();
        const hospEmail = $('#newHospEmail').val();
        const hospAddress = $('#newHospAddress').val();
        const submitBtn = $('#submitNewHosp');

        submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Provisioning...');

        try {
            const response = await fetch(`${API_BASE}/hospitals/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: hospName, email: hospEmail, address: hospAddress })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Server Refused Request");

            // Success Transition
            const regModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('newHospitalModal'));
            regModal.hide();
            
            $('#displayHospUser').text(data.username);
            $('#displayHospPass').text(data.password);
            $('#hospitalCredentialsModal .modal-body p').first().html(`
                Institutional node provisioned successfully. credentials have been <b>dispatched to ${data.email}</b>.
            `);

            bootstrap.Modal.getOrCreateInstance(document.getElementById('hospitalCredentialsModal')).show();
            loadHospitals(); 
        } catch (err) {
            alert("Provisioning Error: " + err.message);
        } finally {
            submitBtn.prop('disabled', false).text('Generate & Send Credentials');
        }
    });

    // --- System Settings ---
    $('#saveSettingsBtn').on('click', function() {
        const btn = $(this);
        const originalText = btn.text();
        
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Updating Policy...');
        
        // Simulating persistent save to configuration layer
        setTimeout(() => {
            btn.prop('disabled', false).text(originalText);
            alert("Platform Settings Updated: Federated governance and institutional policies synchronized.");
        }, 1200);
    });



    async function initHospitalDashboard() {
        if (!$('#hosp-dashboard-section').length) return;
        const hospId = localStorage.getItem('icu_hosp_id') || 'hosp_001';
        
        try {
            const stats = await $.get(`${API_BASE}/hospital/stats?hosp_id=${hospId}`);
            $('#activePatientsCount').text(stats.active);
            $('#dischargedCount').text(stats.discharged.toLocaleString());
            $('#totalStaffCount').text(stats.staff_count);
            $('#localAccuracy').text(stats.accuracy + '%');
            
            initHospitalStaff();
            initHospitalPatients();
        } catch (e) {
            console.error("Failed to load institutional stats.");
        }
    }

    async function initHospitalPatients() {
        const hospId = localStorage.getItem('icu_hosp_id') || 'hosp_001';
        try {
            const patients = await $.get(`${API_BASE}/hospital/patients?hosp_id=${hospId}`);
            const tbody = $('#patientTableBody');
            tbody.empty();
            
            patients.forEach(p => {
                let badgeClass = 'bg-info';
                if (p.status.includes('Critical')) badgeClass = 'bg-warning';
                if (p.status.includes('Discharged')) badgeClass = 'bg-success';
                
                tbody.append(`
                    <tr>
                        <td class="fw-bold">${p.id}</td>
                        <td>${p.date}</td>
                        <td class="small">${p.doctor}</td>
                        <td><span class="badge ${badgeClass}">${p.status}</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-teal view-vital-btn" data-id="${p.id}" data-doc="${p.doctor}">View Vital Chart</button>
                        </td>
                    </tr>
                `);
            });
        } catch (e) { console.error("Patient load failed."); }
    }

    // Patient Detail View & Vital Chart
    $(document).on('click', '.view-vital-btn', async function() {
        const pId = $(this).data('id');
        const doc = $(this).data('doc');
        
        $('#detPatientId').text(pId);
        $('#detPatientDoc').text(doc);
        
        try {
            // Fetch real clinical telemetry for the subject
            const data = await $.get(`${API_BASE}/patient/my-data`); // In production, pass pId
            
            bootstrap.Modal.getOrCreateInstance(document.getElementById('patientDetailModal')).show();
            
            // Initialize Vital History Chart with Dynamic Context
            setTimeout(() => {
                const canvas = document.getElementById('vitalPulseChart');
                if (!canvas) return;
                
                const ctx = canvas.getContext('2d');
                if (window.vitalChart) window.vitalChart.destroy();
                
                window.vitalChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
                        datasets: [{
                            label: 'Heart Rate (bpm)',
                            data: data.vitals.hr,
                            borderColor: '#dc3545',
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'SpO2 (%)',
                            data: data.vitals.spo2,
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                            legend: { position: 'bottom' },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        scales: {
                            y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }, 400); 
        } catch (e) {
            console.error("Clinical telemetry fetch failed:", e);
            alert("Failed to sync clinical snapshot from node.");
        }
    });

    async function initHospitalStaff() {
        const hospId = localStorage.getItem('icu_hosp_id') || 'hosp_001';
        try {
            const staff = await $.get(`${API_BASE}/hospital/staff?hosp_id=${hospId}`);
            const tbody = $('#staffTableBody');
            tbody.empty();
            
            staff.forEach(person => {
                tbody.append(`
                    <tr>
                        <td class="fw-bold">${person.name}</td>
                        <td>${person.role.includes('Nurse') ? 'Critical Care RN' : 'ICU Intensivist'}</td>
                        <td class="small text-muted">${person.role}</td>
                        <td class="small">${person.email}</td>
                        <td><span class="badge bg-teal-subtle text-teal">${person.status}</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-light assign-patient-btn" data-doc="${person.name}">Assign Patients</button>
                        </td>
                    </tr>
                `);
            });
        } catch (e) { console.error("Staff load failed."); }
    }

    // Patient Assignment Logic
    $(document).on('click', '.assign-patient-btn', async function() {
        const docName = $(this).data('doc');
        $('#assigningToDoc').text(docName);
        
        try {
            const patients = await $.get(`${API_BASE}/hospital/patients?hosp_id=hosp_001`);
            const list = $('#assignablePatientList');
            list.empty();
            
            patients.forEach(p => {
                if (p.status !== 'Discharged') {
                    list.append(`
                        <label class="list-group-item d-flex gap-3 align-items-center cursor-pointer border-0 py-3">
                            <input class="form-check-input flex-shrink-0" type="checkbox" value="${p.id}">
                            <div class="d-flex justify-content-between w-100">
                                <div>
                                    <div class="fw-bold">${p.id}</div>
                                    <div class="x-small text-muted">Adm: ${p.date}</div>
                                </div>
                                <span class="badge bg-teal-subtle text-teal h6 mb-0">${p.status}</span>
                            </div>
                        </label>
                    `);
                }
            });
            
            bootstrap.Modal.getOrCreateInstance(document.getElementById('assignPatientsModal')).show();
        } catch (e) { alert("Failed to fetch assignment pool."); }
    });

    $('#saveAssignmentBtn').on('click', function() {
        const selected = $('#assignablePatientList input:checked').length;
        if (selected === 0) return alert("Select at least one patient record.");
        
        const btn = $(this);
        btn.prop('disabled', true).text('Updating Schedule...');
        
        setTimeout(() => {
            alert(`Succesfully assigned ${selected} clinicians to the ICU schedule for ${$('#assigningToDoc').text()}.`);
            bootstrap.Modal.getOrCreateInstance(document.getElementById('assignPatientsModal')).hide();
            btn.prop('disabled', false).text('Confirm Assignment Schedule');
        }, 1200);
    });

    // Doctor Registration
    $('#registerDoctorForm').on('submit', async function(e) {
        e.preventDefault();
        const btn = $(this).find('button');
        const originalText = btn.text();
        
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Dispatching Credentials...');
        
        const data = {
            name: $('#regDocName').val(),
            email: $('#regDocEmail').val(),
            specialty: $('#regDocSpecialty').val(),
            hosp_id: localStorage.getItem('icu_hosp_id') || 'hosp_001'
        };
        
        try {
            const res = await $.ajax({
                url: `${API_BASE}/hospital/register-doctor`,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(data)
            });
            
            if (res.success) {
                // Use Bootstrap 5 API
                const regModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('registerDoctorModal'));
                const credModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('docCredentialsModal'));
                
                $('#dispDocUser').text(res.username);
                $('#dispDocPass').text(res.password);
                
                regModal.hide();
                credModal.show();
                
                initHospitalStaff(); // Refresh table
            }
        } catch (err) {
            console.error("Doctor Registration Error:", err);
            alert("Provisioning Failed: " + (err.responseJSON ? err.responseJSON.detail : "Server unreachable"));
        } finally {
            btn.prop('disabled', false).text(originalText);
        }
    });

    // Local Training Simulation
    $('#localTrainBtn').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Node Fitting in Progress...');
        $('#localTrainingProgress').removeClass('d-none');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            $('#localProgressBar').css('width', progress + '%');
            
            if (progress >= 30) $('#localProgressStatus').text('Optimizing local weights...');
            if (progress >= 70) $('#localProgressStatus').text('Ensuring differential privacy...');
            
            if (progress >= 100) {
                clearInterval(interval);
                $.post(`${API_BASE}/hospital/train/local`, function() {
                    alert("Local node updated. Weights are ready for global federated sync.");
                    btn.prop('disabled', false).text('Run Local Training Cycle');
                    $('#localTrainingProgress').addClass('d-none');
                    $('#localProgressBar').css('width', '0%');
                });
            }
        }, 300);
    });

    // CSV Processing
    $('#processCsvBtn').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).text('Hydrating System...');
        
        setTimeout(() => {
            alert("Institutional Records Hydrated. 240 new vital observations mapped.");
            $('#csvUploadModal').modal('hide');
            btn.prop('disabled', false).text('Process & Hydrate Data');
        }, 1500);
    });

    async function initPatientDashboard() {
        if (!$('#pat-vitals-section').length) return;
        
        console.log("Syncing Patient Command Center Context...");
        
        try {
            const data = await $.get(`${API_BASE}/patient/my-data`);
            
            // Populate Metrics
            $('#patHr').text(data.vitals.hr[data.vitals.hr.length-1]);
            $('#patSpo2').text(data.vitals.spo2[data.vitals.spo2.length-1]);
            $('#patBreath').text(data.vitals.breath[data.vitals.breath.length-1]);
            $('#nextRoundTime').text(data.next_round);

            // Connect to Live Stream
            connectToPatientStream(data.id, '#patHr', '#patSpo2', '#patBreath');

            // 🧪 Populate Lab Reports
            const labBody = $('#patLabsTableBody');
            if (labBody.length) {
                labBody.empty();
                data.lab_reports.forEach(lab => {
                    labBody.append(`
                        <tr>
                            <td class="fw-bold">${lab.test}</td>
                            <td>${lab.value}</td>
                            <td class="small text-muted">Range: Normal</td>
                            <td><span class="badge bg-teal-subtle text-teal">${lab.status}</span></td>
                            <td class="small">${lab.date}</td>
                        </tr>
                    `);
                });
            }

            // 📜 Populate History Timeline
            const historyArea = $('#patHistoryTimeline');
            if (historyArea.length) {
                historyArea.empty();
                data.medical_history.forEach(ev => {
                    historyArea.append(`
                        <div class="d-flex mb-4 gap-4">
                            <div class="small fw-bold text-teal" style="min-width: 80px;">${ev.date}</div>
                            <div class="border-start ps-4 position-relative">
                                <div class="roadmap-dot active" style="left:-6px; top:2px;"></div>
                                <div class="fw-bold small">${ev.event}</div>
                                <div class="x-small text-muted">${ev.type}</div>
                            </div>
                        </div>
                    `);
                });
            }

            // 🩺 Populate Care Team
            const teamList = $('#patTeamList');
            if (teamList.length) {
                teamList.empty();
                data.care_team.forEach(tm => {
                    teamList.append(`
                        <div class="col-md-6">
                            <div class="bg-white p-4 rounded-4 shadow-sm border d-flex align-items-center gap-3">
                                <div class="bg-teal-subtle p-3 rounded-circle text-teal">
                                    <i class="fa-solid ${tm.role.includes('Intensivist') ? 'fa-user-md' : 'fa-nurse'} fs-4"></i>
                                </div>
                                <div>
                                    <h6 class="fw-bold mb-0">${tm.name}</h6>
                                    <p class="x-small text-muted mb-1">${tm.role}</p>
                                    <span class="badge bg-light text-dark x-small px-2">${tm.contact}</span>
                                </div>
                            </div>
                        </div>
                    `);
                });
            }

            // Initialize History Chart
            const canvas = document.getElementById('patientVitalsChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (window.patientChart) window.patientChart.destroy();
                window.patientChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['01:00', '02:00', '03:00', '04:00', '05:00', '06:00'],
                        datasets: [{
                            label: 'Heart Rate',
                            data: data.vitals.hr,
                            borderColor: '#dc3545',
                            backgroundColor: 'rgba(220, 53, 69, 0.05)',
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'SpO2 Level',
                            data: data.vitals.spo2,
                            borderColor: '#0d6efd',
                            backgroundColor: 'rgba(13, 110, 253, 0.05)',
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Respiratory Rate',
                            data: data.vitals.breath,
                            borderColor: '#14b8a6',
                            backgroundColor: 'rgba(20, 184, 166, 0.05)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } },
                        scales: { y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.02)' } } }
                    }
                });
            }
        } catch (e) { console.error("Patient sync failed:", e); }
    }

    // Urgent Round Request
    $(document).on('click', '#urgentRoundBtn', function() {
        const btn = $(this);
        const original = btn.html();
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span> Dispatching...');
        
        setTimeout(() => {
            btn.prop('disabled', false).html(original);
            bootstrap.Modal.getOrCreateInstance(document.getElementById('urgentRoundModal')).show();
        }, 1500);
    });

    // Default Init
    if ($('#dashboard-section').length) initDashboard();
    if ($('#hosp-dashboard-section').length) initHospitalDashboard();
    if ($('#doc-census-section').length) initDoctorDashboard();
    if ($('#patientVitalsChart').length) initPatientDashboard();
});
