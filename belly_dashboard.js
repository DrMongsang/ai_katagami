// 出腹分析ダッシュボード - メインJavaScript

let rawData = null;
let filteredData = null;
let charts = {};

// データ読み込み
async function loadData() {
    try {
        const response = await fetch('belly_data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        rawData = await response.json();
        console.log('データ読み込み完了:', rawData.metadata);

        // 初期化
        initializeFilters();
        applyFilters();
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        alert('データの読み込みに失敗しました。belly_data.jsonファイルが存在するか確認してください。');
    }
}

// フィルタ初期化
function initializeFilters() {
    // 店舗フィルタ
    const storeFilter = document.getElementById('store-filter');
    storeFilter.innerHTML = '<option value="all" selected>全店舗</option>';
    rawData.stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store.name;
        option.textContent = `${store.name} (${store.count}件)`;
        storeFilter.appendChild(option);
    });

    // 担当者フィルタ
    const staffFilter = document.getElementById('staff-filter');
    staffFilter.innerHTML = '<option value="all" selected>全担当者</option>';
    rawData.staff.slice(0, 50).forEach(staff => { // 上位50名のみ表示
        const option = document.createElement('option');
        option.value = staff.name;
        option.textContent = `${staff.name} (${staff.count}件)`;
        staffFilter.appendChild(option);
    });

    // 日付ピッカー
    flatpickr('#date-start', {
        locale: 'ja',
        dateFormat: 'Y-m-d',
        defaultDate: rawData.metadata.date_range.start
    });

    flatpickr('#date-end', {
        locale: 'ja',
        dateFormat: 'Y-m-d',
        defaultDate: rawData.metadata.date_range.end
    });

    // イベントリスナー
    document.getElementById('apply-filter').addEventListener('click', applyFilters);
    document.getElementById('reset-filter').addEventListener('click', resetFilters);
    document.getElementById('export-csv').addEventListener('click', exportCSV);
}

// フィルタ適用
function applyFilters() {
    const storeFilter = document.getElementById('store-filter');
    const staffFilter = document.getElementById('staff-filter');
    const dateStart = document.getElementById('date-start').value || rawData.metadata.date_range.start;
    const dateEnd = document.getElementById('date-end').value || rawData.metadata.date_range.end;

    const selectedStores = Array.from(storeFilter.selectedOptions).map(opt => opt.value);
    const selectedStaff = Array.from(staffFilter.selectedOptions).map(opt => opt.value);

    filteredData = rawData.records.filter(record => {
        // 店舗フィルタ
        if (!selectedStores.includes('all') && !selectedStores.includes(record.store)) {
            return false;
        }

        // 担当者フィルタ
        if (!selectedStaff.includes('all') && !selectedStaff.includes(record.staff)) {
            return false;
        }

        // 日付フィルタ
        if (record.order_date < dateStart || record.order_date > dateEnd) {
            return false;
        }

        return true;
    });

    console.log(`フィルタ適用: ${filteredData.length}件`);
    updateDashboard();
}

// フィルタリセット
function resetFilters() {
    document.getElementById('store-filter').selectedIndex = 0;
    document.getElementById('staff-filter').selectedIndex = 0;
    document.getElementById('date-start').value = rawData.metadata.date_range.start;
    document.getElementById('date-end').value = rawData.metadata.date_range.end;
    applyFilters();
}

// ダッシュボード更新
function updateDashboard() {
    updateKPIs();
    updateCharts();
    updateTables();
}

// KPI更新
function updateKPIs() {
    const totalCount = filteredData.length;
    const uniqueCustomers = new Set(filteredData.map(r => r.member_id)).size;

    // 体型データが必要なので、元のdistributionsから計算
    // 簡易版として、repair_classの分布を表示
    const repairDCount = filteredData.filter(r => r.repair_class && r.repair_class.includes('D')).length;

    document.getElementById('kpi-total').textContent = totalCount.toLocaleString();
    document.getElementById('kpi-customers').textContent = uniqueCustomers.toLocaleString();
    document.getElementById('kpi-belly-concern').textContent = '-'; // 体型データがrecordsにないため
    document.getElementById('kpi-repair-d').textContent = repairDCount.toLocaleString();
}

// グラフ更新
function updateCharts() {
    // Chart.jsのデフォルト設定
    Chart.defaults.font.family = "'Segoe UI', 'Hiragino Sans', 'Yu Gothic', sans-serif";
    Chart.defaults.plugins.legend.position = 'bottom';

    // 体型区分グラフ（元データから）
    updateBodyTypeChart();

    // 身長区分グラフ（元データから）
    updateHeightChart();

    // お直し分類グラフ
    updateRepairChart();

    // 時系列グラフ
    updateTimeSeriesChart();
}

// 体型区分グラフ
function updateBodyTypeChart() {
    const ctx = document.getElementById('bodyTypeChart').getContext('2d');

    if (charts.bodyType) {
        charts.bodyType.destroy();
    }

    const bodyTypeData = rawData.distributions.body_type;
    const labels = Object.keys(bodyTypeData);
    const data = labels.map(key => bodyTypeData[key].count);
    const colors = {
        '非出腹': '#27AE60',
        '出腹懸念': '#F39C12',
        '出腹': '#E67E22',
        '強出腹': '#E74C3C',
        'BMI肥満だが非出腹': '#3498DB'
    };

    charts.bodyType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map(label => colors[label] || '#95A5A6'),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString()}件 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 身長区分グラフ
function updateHeightChart() {
    const ctx = document.getElementById('heightChart').getContext('2d');

    if (charts.height) {
        charts.height.destroy();
    }

    const heightData = rawData.distributions.height;
    const labels = ['H1', 'H2', 'H3', 'H4', 'H5'];
    const data = labels.map(key => heightData[key] ? heightData[key].count : 0);

    charts.height = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(h => {
                const ranges = {
                    'H1': '〜160cm',
                    'H2': '161-165cm',
                    'H3': '166-174cm',
                    'H4': '175-179cm',
                    'H5': '180cm〜'
                };
                return `${h}\n${ranges[h]}`;
            }),
            datasets: [{
                label: '件数',
                data: data,
                backgroundColor: '#3498DB',
                borderColor: '#2980B9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `件数: ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}

// お直し分類グラフ
function updateRepairChart() {
    const ctx = document.getElementById('repairChart').getContext('2d');

    if (charts.repair) {
        charts.repair.destroy();
    }

    // フィルタ済みデータから集計
    const repairCounts = {};
    filteredData.forEach(record => {
        const repairClass = record.repair_class || '不明';
        repairCounts[repairClass] = (repairCounts[repairClass] || 0) + 1;
    });

    const labels = Object.keys(repairCounts).sort();
    const data = labels.map(key => repairCounts[key]);

    const colors = {
        'A（満足お直し）': '#27AE60',
        'B（部位数：少／調整数値：大）': '#F39C12',
        'C（部位数：多／調整数値：小）': '#E67E22',
        'D（部位数：多／調整数値：大）': '#E74C3C'
    };

    charts.repair = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map(label => colors[label] || '#95A5A6'),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString()}件 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 時系列グラフ
function updateTimeSeriesChart() {
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');

    if (charts.timeSeries) {
        charts.timeSeries.destroy();
    }

    // 月別集計
    const monthlyCounts = {};
    filteredData.forEach(record => {
        if (record.order_date) {
            const month = record.order_date.substring(0, 7); // YYYY-MM
            monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
        }
    });

    const labels = Object.keys(monthlyCounts).sort();
    const data = labels.map(key => monthlyCounts[key]);

    charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '月別件数',
                data: data,
                borderColor: '#3498DB',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `件数: ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}

// テーブル更新
function updateTables() {
    updateStoreRanking();
    updateStaffRanking();
}

// 店舗別ランキング
function updateStoreRanking() {
    const storeCounts = {};
    const storeRepairD = {};

    filteredData.forEach(record => {
        const store = record.store || '不明';
        storeCounts[store] = (storeCounts[store] || 0) + 1;
        if (record.repair_class && record.repair_class.includes('D')) {
            storeRepairD[store] = (storeRepairD[store] || 0) + 1;
        }
    });

    const ranking = Object.keys(storeCounts)
        .map(store => ({
            store,
            count: storeCounts[store],
            repairD: storeRepairD[store] || 0,
            repairDRate: ((storeRepairD[store] || 0) / storeCounts[store] * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const tbody = document.querySelector('#store-ranking tbody');
    tbody.innerHTML = '';

    ranking.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${index + 1}</strong></td>
            <td>${item.store}</td>
            <td>${item.count.toLocaleString()}</td>
            <td><span class="badge badge-warning">-</span></td>
            <td><span class="badge ${item.repairDRate > 40 ? 'badge-danger' : item.repairDRate > 30 ? 'badge-warning' : 'badge-success'}">${item.repairDRate}%</span></td>
        `;
    });
}

// 担当者別ランキング
function updateStaffRanking() {
    const staffCounts = {};
    const staffRepairD = {};

    filteredData.forEach(record => {
        const staff = record.staff || '不明';
        staffCounts[staff] = (staffCounts[staff] || 0) + 1;
        if (record.repair_class && record.repair_class.includes('D')) {
            staffRepairD[staff] = (staffRepairD[staff] || 0) + 1;
        }
    });

    const ranking = Object.keys(staffCounts)
        .map(staff => ({
            staff,
            count: staffCounts[staff],
            repairD: staffRepairD[staff] || 0,
            repairDRate: ((staffRepairD[staff] || 0) / staffCounts[staff] * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const tbody = document.querySelector('#staff-ranking tbody');
    tbody.innerHTML = '';

    ranking.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${index + 1}</strong></td>
            <td>${item.staff}</td>
            <td>${item.count.toLocaleString()}</td>
            <td><span class="badge badge-warning">-</span></td>
            <td><span class="badge ${item.repairDRate > 40 ? 'badge-danger' : item.repairDRate > 30 ? 'badge-warning' : 'badge-success'}">${item.repairDRate}%</span></td>
        `;
    });
}

// CSV出力
function exportCSV() {
    if (!filteredData || filteredData.length === 0) {
        alert('出力するデータがありません');
        return;
    }

    const headers = ['注文ID', '顧客ID', '注文日', '出荷日', 'お直し日', '店舗', '担当者', 'お直し分類', '注文区分', 'カテゴリ', 'アイテム'];
    const rows = filteredData.map(record => [
        record.order_id,
        record.member_id,
        record.order_date,
        record.ship_date,
        record.repair_date,
        record.store,
        record.staff,
        record.repair_class,
        record.order_kbn,
        record.category_name,
        record.item_name
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    link.setAttribute('href', url);
    link.setAttribute('download', `belly_analysis_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 初期化
document.addEventListener('DOMContentLoaded', loadData);
