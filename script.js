document.addEventListener('DOMContentLoaded', () => {
    const screens = {
        start: document.getElementById('screen-start'),
        modeSelect: document.getElementById('screen-mode-select'),
        step1Easy: document.getElementById('screen-step1-easy'),
        step1Pro: document.getElementById('screen-step1-pro'),
        step2: document.getElementById('screen-step2'),
        loading: document.getElementById('screen-loading'),
        result: document.getElementById('screen-result'),
    };

    const buttons = {
        start: document.getElementById('start-btn'),
        modeEasy: document.getElementById('mode-easy-btn'),
        modePro: document.getElementById('mode-pro-btn'),
        nextEasy: screens.step1Easy.querySelector('.next-btn'),
        nextPro: screens.step1Pro.querySelector('.next-btn'),
        analyze: document.getElementById('analyze-btn'),
        restart: document.getElementById('restart-btn'),
    };

    const inputs = {
        height: document.getElementById('height'),
        weight: document.getElementById('weight'),
        fit: document.getElementById('fit-preference'),
        style: document.getElementById('style-preference'),
        nudeInputs: {},
    };

    const resultElements = {
        styleType: document.getElementById('style-type-result'),
        nudeSource: document.getElementById('nude-source'),
        nudeTable: document.getElementById('nude-results-table').getElementsByTagName('tbody')[0],
        jacketRecoTable: document.getElementById('jacket-reco-table').getElementsByTagName('tbody')[0],
        pantsRecoTable: document.getElementById('pants-reco-table').getElementsByTagName('tbody')[0],
        jacketFinalTable: document.getElementById('jacket-final-table').getElementsByTagName('tbody')[0],
        pantsFinalTable: document.getElementById('pants-final-table').getElementsByTagName('tbody')[0],
    };

    const nudeFeatures = [
        "neck", "shoulder_nu", "ssleeve_nu", "wrist", "chest_nu",
        "waist_nu", "pwaist_nu", "hip", "fork_nu", "knee_nu", "calf_nu"
    ];

    let models = null;
    let userData = {};
    let diagnosticMode = ''; // 'easy' or 'pro'

    // --- Model Loading ---
    async function loadModels() {
        try {
            const response = await fetch('sizing_models.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            models = await response.json();
            console.log("Models loaded successfully");
        } catch (e) {
            console.error("Could not load sizing models:", e);
            alert("エラー: sizing_models.json の読み込みに失敗しました。ファイルが同じディレクトリにあるか確認してください。");
        }
    }

    // --- Screen Navigation ---
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    buttons.start.addEventListener('click', () => showScreen('modeSelect'));

    buttons.modeEasy.addEventListener('click', () => {
        diagnosticMode = 'easy';
        showScreen('step1Easy');
    });

    buttons.modePro.addEventListener('click', () => {
        diagnosticMode = 'pro';
        generateNudeInputs(); // Generate inputs for pro mode
        showScreen('step1Pro');
    });

    buttons.nextEasy.addEventListener('click', () => {
        if (inputs.height.value && inputs.weight.value) {
            userData.height = parseFloat(inputs.height.value);
            userData.weight = parseFloat(inputs.weight.value);
            showScreen('step2');
        } else {
            alert("身長と体重を入力してください。");
        }
    });

    buttons.nextPro.addEventListener('click', () => {
        let allInputsFilled = true;
        userData.nudeDimensions = {};
        nudeFeatures.forEach(feature => {
            const inputVal = inputs.nudeInputs[feature].value;
            if (!inputVal) {
                allInputsFilled = false;
            } else {
                userData.nudeDimensions[feature] = parseFloat(inputVal);
            }
        });

        if (allInputsFilled) {
            showScreen('step2');
        } else {
            alert("すべてのヌード寸法を入力してください。");
        }
    });

    buttons.analyze.addEventListener('click', () => {
        userData.fit = inputs.fit.value;
        userData.style = inputs.style.value;
        showScreen('loading');
        setTimeout(() => {
            performAnalysis();
            showScreen('result');
        }, 1500);
    });

    buttons.restart.addEventListener('click', () => {
        inputs.height.value = '';
        inputs.weight.value = '';
        // Clear pro inputs
        nudeFeatures.forEach(feature => {
            if (inputs.nudeInputs[feature]) {
                inputs.nudeInputs[feature].value = '';
            }
        });
        showScreen('start');
    });

    // --- Nude Input Generation for Pro Mode ---
    function generateNudeInputs() {
        const grid = screens.step1Pro.querySelector('.nude-input-grid');
        grid.innerHTML = ''; // Clear previous inputs
        nudeFeatures.forEach(feature => {
            const inputGroup = document.createElement('div');
            inputGroup.classList.add('input-group');
            const label = document.createElement('label');
            label.setAttribute('for', feature);
            label.textContent = feature.replace('_nu', '').replace('_jk', '').replace('_sl', ''); // Clean up label
            const input = document.createElement('input');
            input.type = 'number';
            input.id = feature;
            input.placeholder = 'cm';
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            grid.appendChild(inputGroup);
            inputs.nudeInputs[feature] = input; // Store reference
        });
    }

    // --- Calculation Logic ---
    function predict(model, features) {
        let prediction = model.intercept;
        for (let i = 0; i < features.length; i++) {
            // Ensure feature value is a number
            const featureValue = parseFloat(features[i]);
            if (isNaN(featureValue)) {
                console.warn(`Invalid feature value encountered: ${features[i]}. Using 0 for calculation.`);
                continue; // Skip this feature or handle as appropriate
            }
            prediction += featureValue * model.coef[i];
        }
        return prediction;
    }

    function performAnalysis() {
        try {
            if (!models) throw new Error("モデルが読み込まれていません。");

            let currentNudes = {};
            if (diagnosticMode === 'easy') {
                // Part 1: Predict Nude Dimensions from Height/Weight
                const hw_features = [userData.height, userData.weight];
                const nude_feature_keys = Object.keys(models.nude_models);
                nude_feature_keys.forEach(key => {
                    currentNudes[key] = predict(models.nude_models[key], hw_features);
                });
                resultElements.nudeSource.textContent = "AI予測";
            } else if (diagnosticMode === 'pro') {
                // Part 1: Use User-Entered Nude Dimensions
                currentNudes = userData.nudeDimensions;
                resultElements.nudeSource.textContent = "手入力";
            }

            // Part 2: Predict AI Recommended Garment Sizes from Nude Dimensions
            const nude_values_ordered = nudeFeatures.map(key => currentNudes[key]);
            
            const jacket_reco = {};
            Object.keys(models.jacket_models).forEach(key => {
                jacket_reco[key] = predict(models.jacket_models[key], nude_values_ordered);
            });
            const pants_reco = {};
            Object.keys(models.pants_models).forEach(key => {
                pants_reco[key] = predict(models.pants_models[key], nude_values_ordered);
            });

            // Part 3: Calculate Final Sizes based on Preference
            const fit_multiplier = {
                "タイト": 0.98, // -2%
                "ジャスト": 1.0,  // 0%
                "ルーズ": 1.03   // +3%
            }[userData.fit];

            const jacket_final = {};
            for (const key in jacket_reco) {
                jacket_final[key] = jacket_reco[key] * fit_multiplier;
            }
            const pants_final = {};
            for (const key in pants_reco) {
                pants_final[key] = pants_reco[key] * fit_multiplier;
            }

            displayResults(currentNudes, jacket_reco, pants_reco, jacket_final, pants_final);

        } catch (error) {
            console.error("An error occurred during analysis:", error);
            alert(`分析中にエラーが発生しました: ${error.message}`);
            showScreen('start');
        }
    }

    function displayResults(nudes, jacketReco, pantsReco, jacketFinal, pantsFinal) {
        resultElements.styleType.textContent = `あなたは【${userData.fit}・${userData.style}】タイプ！`;

        const populateTable = (tbody, data) => {
            tbody.innerHTML = '';
            for (const [key, value] of Object.entries(data)) {
                const row = tbody.insertRow();
                row.innerHTML = `<td>${key.replace('_nu', '').replace('_jk', '').replace('_sl', '')}</td><td>${value.toFixed(2)} cm</td>`;
            }
        };
        
        populateTable(resultElements.nudeTable, nudes);
        populateTable(resultElements.jacketRecoTable, jacketReco);
        populateTable(resultElements.pantsRecoTable, pantsReco);
        populateTable(resultElements.jacketFinalTable, jacketFinal);
        populateTable(resultElements.pantsFinalTable, pantsFinal);
    }

    // --- Initial Load ---
    loadModels();
    showScreen('start');
});