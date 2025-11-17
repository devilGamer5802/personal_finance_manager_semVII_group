const domRefs = {
	overlay: null,
	loadingText: null,
	insightsList: null,
	predictionResultMain: null,
	predictionResultAlt: null,
	runMeta: null,
	sampleStatus: null,
	sampleProfile: null,
};

const currencyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
let formsHydrated = false;

document.addEventListener('DOMContentLoaded', () => {
	captureDomRefs();
	const dashboardCharts = document.querySelector('[data-charts]');
	if (dashboardCharts) {
		loadSampleDashboard();
		document.getElementById('refresh-dashboard')?.addEventListener('click', loadSampleDashboard);
		document.getElementById('prediction-form')?.addEventListener('submit', (e) => submitPrediction(e));
	}

	const inputForm = document.getElementById('input-form');
	if (inputForm) {
		loadSampleDashboard();
		inputForm.addEventListener('submit', (e) => submitPrediction(e));
	}
});

function captureDomRefs(){
	domRefs.overlay = document.getElementById('loading-overlay');
	domRefs.loadingText = document.getElementById('loading-text');
	domRefs.insightsList = document.getElementById('insights-list');
	domRefs.predictionResultMain = document.getElementById('prediction-result');
	domRefs.predictionResultAlt = document.getElementById('prediction-result-alt');
	domRefs.runMeta = document.getElementById('run-meta');
	domRefs.sampleStatus = document.getElementById('sample-status');
	domRefs.sampleProfile = document.getElementById('sample-profile');
}

async function loadSampleDashboard(){
	setSampleStatus('Loading sample analytics…');
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);
	try {
		const res = await fetch('/api/sample-dashboard', { signal: controller.signal });
		if (!res.ok) throw new Error('API error');
		const data = await res.json();
		renderCharts(data.charts);
		renderInsights(data.insights);
		populateSelects(data.options);
		renderSampleProfile(data.sample_profile);
		window.__dashboardLoaded = true;
		setSampleStatus('Updated just now');
	} catch (err) {
		console.error(err);
		if (err.name === 'AbortError') {
			setSampleStatus('Request timed out. Ensure the Flask server is running.');
		} else {
			setSampleStatus('Unable to load dashboard snapshot.');
		}
		renderSampleProfile(null);
		renderInsights(['Unable to load dashboard snapshot. Check Flask server.']);
	} finally {
		clearTimeout(timeoutId);
	}
}

function setSampleStatus(text){
	if (domRefs.sampleStatus) domRefs.sampleStatus.textContent = text || '';
}

function renderSampleProfile(profile){
	if (!domRefs.sampleProfile) return;
	if (!profile){
		domRefs.sampleProfile.textContent = '';
		return;
	}
	const pieces = [];
	if (typeof profile.Income === 'number') pieces.push(`Income ₹${currencyFormatter.format(profile.Income)}`);
	if (profile.Age !== undefined) pieces.push(`Age ${profile.Age}`);
	if (profile.Dependents !== undefined) pieces.push(`Dependents ${profile.Dependents}`);
	if (profile.City_Tier) pieces.push(profile.City_Tier);
	domRefs.sampleProfile.textContent = `Sample (Step 7): ${pieces.join(' • ')}`;
	hydrateFormDefaults(profile);
}

function hydrateFormDefaults(profile){
	if (formsHydrated) return;
	const forms = [document.getElementById('prediction-form'), document.getElementById('input-form')].filter(Boolean);
	if (!forms.length) return;
	forms.forEach((form) => {
		Object.entries(profile).forEach(([key, value]) => {
			const field = form.querySelector(`[name="${key}"]`);
			if (field && field.type !== 'select-one') {
				field.value = value;
			}
		});
		if (profile.Occupation) {
			const occ = form.querySelector('select[name="Occupation"]');
			if (occ) {
				ensureOption(occ, profile.Occupation);
				occ.value = profile.Occupation;
			}
		}
		if (profile.City_Tier) {
			const city = form.querySelector('select[name="City_Tier"]');
			if (city) {
				ensureOption(city, profile.City_Tier);
				city.value = profile.City_Tier;
			}
		}
	});
	formsHydrated = true;
}

function ensureOption(selectEl, value){
	const exists = Array.from(selectEl.options).some((opt) => opt.value === value);
	if (!exists){
		const option = document.createElement('option');
		option.value = value;
		option.textContent = value;
		selectEl.appendChild(option);
	}
}

function populateSelects(options){
	if (!options) return;
	const occupationOptions = options.occupations || [];
	const cityOptions = options.city_tiers || [];
	const occSelects = [document.getElementById('occupation-select'), document.getElementById('occupation-select-alt')].filter(Boolean);
	const citySelects = [document.getElementById('city-select'), document.getElementById('city-select-alt')].filter(Boolean);
	occSelects.forEach(sel => {
		sel.innerHTML = '';
		occupationOptions.forEach((label, idx) => {
			const opt = document.createElement('option');
			opt.value = label;
			opt.textContent = label;
			if (idx === 0) opt.selected = true;
			sel.appendChild(opt);
		});
	});
	citySelects.forEach(sel => {
		sel.innerHTML = '';
		cityOptions.forEach((label, idx) => {
			const opt = document.createElement('option');
			opt.value = label;
			opt.textContent = label;
			if (idx === 0) opt.selected = true;
			sel.appendChild(opt);
		});
	});
}

function renderCharts(charts){
	if (!charts) return;
	renderScatter(charts.scatter);
	renderPie(charts.pie);
	renderBar(charts.bar);
	renderProjection(charts.projection);
	renderHeatmap(charts.heatmap);
}

function renderScatter(data){
	const mount = document.querySelector('#scatter-income-expenses .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.income,
		y: data.totalExpenses,
		text: data.cityTier,
		marker: { color: data.savingsPct, colorscale: 'Turbo', size: 10, showscale: true, colorbar: {title: 'Savings %'} },
		mode: 'markers',
		type: 'scatter',
	}], {
		template: 'plotly_dark',
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: 'rgba(0,0,0,0)',
		xaxis: { title: 'Income (₹)' },
		yaxis: { title: 'Total Expenses (₹)' },
		margin: { l: 50, r: 10, t: 10, b: 40 },
	}, {responsive: true});
}

function renderPie(data){
	const mount = document.querySelector('#pie-expenses .chart');
	if (!mount || !data) return;
	if (!data.labels?.length){
		mount.innerHTML = '<p class="muted">No expense columns detected.</p>';
		return;
	}
	Plotly.react(mount, [{
		labels: data.labels,
		values: data.values,
		type: 'pie',
		textinfo: 'label+percent',
		hole: 0.35,
	}], {
		template: 'plotly_dark',
		margin: { t: 10, b: 10 },
	}, {responsive: true});
}

function renderBar(data){
	const mount = document.querySelector('#bar-occupation-expense .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.labels,
		y: data.values,
		type: 'bar',
		marker: {color: '#25b3ff'},
	}], {
		template: 'plotly_dark',
		margin: { b: 80, t: 10 },
		xaxis: { tickangle: -35 },
		yaxis: { title: 'Avg Total Expenses (₹)' },
	}, {responsive: true});
}

function renderProjection(data){
	const mount = document.querySelector('#line-projection .chart');
	if (!mount || !data) return;
	Plotly.react(mount, [{
		x: data.months,
		y: data.values,
		mode: 'lines+markers',
		line: {color: '#0af5ff'},
		marker: {color: '#25b3ff'},
	}], {
		template: 'plotly_dark',
		xaxis: { title: 'Month' },
		yaxis: { title: 'Projected Savings (₹)' },
		margin: { t: 10, l: 60, r: 20, b: 40 },
	}, {responsive: true});
}

function renderHeatmap(data){
	const mount = document.querySelector('#heatmap-corr .chart');
	if (!mount || !data) return;
	if (!data.labels?.length){
		mount.innerHTML = '<p class="muted">No numeric columns for heatmap.</p>';
		return;
	}
	Plotly.react(mount, [{
		z: data.matrix,
		x: data.labels,
		y: data.labels,
		type: 'heatmap',
		colorscale: 'RdBu',
		zmin: -1,
		zmax: 1,
	}], {
		template: 'plotly_dark',
		margin: { t: 10, b: 40 },
	}, {responsive: true});
}

function renderInsights(items){
	if (!domRefs.insightsList) return;
	domRefs.insightsList.innerHTML = '';
	(items || []).forEach(text => {
		const li = document.createElement('li');
		li.textContent = text;
		domRefs.insightsList.appendChild(li);
	});
}

async function submitPrediction(event){
	event.preventDefault();
	const form = event.target;
	const payload = buildPayload(form);
	showLoader('Executing notebook via nbclient… (~30s)');
	
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
	
	try {
		const res = await fetch('/api/run-notebook', {
			method: 'POST',
			headers: {'Content-Type':'application/json'},
			body: JSON.stringify(payload),
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		
		const data = await res.json();
		if (!res.ok || data.error){
			throw new Error(data.error || 'Notebook execution failed');
		}
		updatePredictionUI(data);
	} catch (err) {
		console.error(err);
		clearTimeout(timeoutId);
		if (err.name === 'AbortError') {
			updatePredictionUI({ error: 'Request timed out. The notebook is taking longer than expected.' });
		} else {
			updatePredictionUI({ error: err.message });
		}
	} finally {
		hideLoader();
	}
}

function buildPayload(form){
	const fd = new FormData(form);
	const payload = {};
	fd.forEach((value, key) => { payload[key] = value; });
	['Income','Age','Dependents','Total_Expenses','Desired_Savings_Percentage','Disposable_Income'].forEach(key => {
		if (payload[key] !== undefined) payload[key] = parseFloat(payload[key]);
	});
	return payload;
}

function updatePredictionUI(data){
	const targetMain = domRefs.predictionResultMain;
	const targetAlt = domRefs.predictionResultAlt;
	const content = buildPredictionMarkup(data);
	if (targetMain) targetMain.innerHTML = content;
	if (targetAlt) targetAlt.innerHTML = content;
	if (domRefs.runMeta && data.elapsed_ms) domRefs.runMeta.textContent = `Notebook runtime: ${data.elapsed_ms} ms`;
}

function buildPredictionMarkup(data){
	if (data.error){
		return `<p class="muted">${data.error}</p>`;
	}
	const pred = data.predicted_desired_savings ? Number(data.predicted_desired_savings).toLocaleString('en-IN') : 'N/A';
	const prob = typeof data.overspend_probability === 'number' ? `${(data.overspend_probability * 100).toFixed(1)}%` : 'N/A';
	const elapsed = data.elapsed_ms ? `${data.elapsed_ms} ms` : '—';
	return `
		<h4>Predicted Desired Savings</h4>
		<p><strong>₹${pred}</strong> per month</p>
		<p>Overspend probability: <strong>${prob}</strong></p>
		<p class="muted">Notebook runtime: ${elapsed}</p>
	`;
}

function showLoader(text){
	if (!domRefs.overlay) return;
	domRefs.overlay.hidden = false;
	if (domRefs.loadingText) domRefs.loadingText.textContent = text;
}

function hideLoader(){
	if (!domRefs.overlay) return;
	domRefs.overlay.hidden = true;
}

