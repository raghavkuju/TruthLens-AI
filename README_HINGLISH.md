# TruthLens AI Dashboard — Setup Guide (Hinglish)

## ZIP ke andar kya hai?
- `app.py` — Flask backend/API
- `utils.py` — trained model load karna, text clean karna, prediction aur explanation
- `templates/index.html` — dashboard UI
- `static/style.css` — dashboard design
- `static/script.js` — frontend interactions aur API calls
- `requirements.txt` — Python dependencies

## IMPORTANT: Apna trained model preserve karein
Aapka existing trained model `models/model.joblib` hai. ZIP mein jaan-boojhkar model file include nahi ki gayi, kyunki aapka already-trained model aapke project mein maujood hai aur use overwrite nahi karna chahiye.

Expected folder structure:
```
truthlens/
├── app.py
├── utils.py
├── train.py                 # existing file; keep it
├── requirements.txt
├── models/
│   └── model.joblib         # your existing trained model; KEEP IT
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## Step 1 — Backup
Apne current project folder ka backup bana lo. Kam se kam `models/model.joblib`, `train.py`, aur `utils.py` ki copy rakho.

## Step 2 — ZIP extract/copy
ZIP extract karo. Extracted `app.py`, `utils.py`, `templates/index.html`, `static/style.css`, `static/script.js`, aur `requirements.txt` ko apne existing project folder mein copy karo.
Agar Windows overwrite poochhe, sirf upar listed dashboard files ko replace karo. `models/model.joblib` aur `train.py` ko replace/delete mat karna.

## Step 3 — PowerShell mein project folder kholna
```powershell
cd E:\files\truthlens\truthlens
```
Virtual environment pehle se hai to activate karo:
```powershell
.\.venv\Scripts\Activate.ps1
```
Agar activation execution policy se block ho, PowerShell ko administrator ke taur par badalne ki zaroorat nahi: usi terminal mein ye command use kar sakte ho:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

## Step 4 — Packages install karo
```powershell
python -m pip install -r requirements.txt
```

## Step 5 — Model file verify karo
```powershell
Test-Path .\models\model.joblib
```
Output `True` hona chahiye. Agar `False` hai, apni original trained model file ko `models\model.joblib` path par rakho. Model ko dobara train karna zaroori nahi hai.

Bundle ka expected format dictionary hai, jisme kam se kam `vectorizer` aur `model` keys hon. Aapke existing bundle mein `deployed`, `metrics`, `cv_f1_mean`, `n_articles` metadata bhi hai.

Optional quick check:
```powershell
python -c "import joblib; b=joblib.load('models/model.joblib'); print(type(b)); print(b.keys())"
```

Expected keys mein `vectorizer` aur `model` honi chahiye.

## Step 6 — Backend start karo
```powershell
python -u .\app.py
```
Expected output mein `TruthLens AI starting...` aur Flask ka local address aana chahiye. Terminal ko chalta rehne do.

## Step 7 — Browser mein dashboard kholo
Open:
http://127.0.0.1:5000

Pehle `/api/status` endpoint bhi check kar sakte ho:
http://127.0.0.1:5000/api/status

Status JSON mein `"status": "ok"` aana chahiye. Agar model load nahi hua, response mein `details` aur expected model path milega.

## Model connection ka flow
1. Browser mein headline + article text submit hota hai.
2. `static/script.js` JSON request `/api/analyze` par bhejta hai.
3. `app.py` `utils.load_bundle()` se `models/model.joblib` load karta hai.
4. `utils.predict_text()` saved `vectorizer` se input ko transform karta hai.
5. Saved classifier REAL probability deta hai. Project ke training convention ke mutabiq class `1 = REAL`, class `0 = FAKE`.
6. API prediction, probability aur model ke supported influential terms browser ko return karti hai.

## Common errors
### `ModuleNotFoundError: No module named 'flask'`
```powershell
python -m pip install -r requirements.txt
```
Ensure install aur run dono same `(.venv)` terminal mein ho.

### `Trained model not found`
`models\model.joblib` ka path aur spelling check karo:
```powershell
Get-Item .\models\model.joblib
```

### `KeyError: vectorizer` ya `model`
Bundle ka format is dashboard ke expected format se different hai. File ko delete mat karo; `python -c "import joblib; print(joblib.load('models/model.joblib').keys())"` ka output inspect karo.

### Dashboard khulta hai, lekin model offline hai
Browser mein `http://127.0.0.1:5000/api/status` kholo aur JSON error dekho. PowerShell mein Flask terminal ka error bhi check karo.

### Port 5000 already in use
Doosre Flask terminal ko band karo, ya `app.py` mein `port=5000` ko `port=5001` karo; phir browser mein `http://127.0.0.1:5001` kholo.

## Feature limitations
- Pasted article text analysis implemented hai.
- URL tab filhaal batata hai ki URL extraction connected nahi hai. URL se page content automatically fetch karna is package mein implemented nahi hai.
- History browser ke local storage mein hai, database mein nahi.
- Prediction ek machine-learning estimate hai; fact-check ka final proof nahi. Reliable independent sources se claims verify karo.
