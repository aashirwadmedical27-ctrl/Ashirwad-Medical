import { useState } from 'react'
import axios from 'axios'

/* ------------------------------------------------------------------ */
/*  LOCAL AXIOS INSTANCE                                               */
/* ------------------------------------------------------------------ */
const api = axios.create({ baseURL: 'http://localhost:5000/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Request failed'
    return Promise.reject(new Error(message))
  }
)

/* ------------------------------------------------------------------ */
/*  LOCAL HELPERS                                                      */
/* ------------------------------------------------------------------ */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

async function uploadToCloudinary(file) {
  if (!file) return { url: '', publicId: '' }
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Please add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your frontend .env file.'
    )
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'medical-app/medicines')

  const { data } = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    formData
  )
  return { url: data.secure_url || '', publicId: data.public_id || '' }
}

/* ------------------------------------------------------------------ */
/*  LOCAL ICONS                                                        */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  plus: <><path d="M12 5v14M5 12h14" /></>,
  pill: <><rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
}

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  LOCAL UI PIECES                                                    */
/* ------------------------------------------------------------------ */
function Field({ label, hint, full, children }) {
  return (
    <label className={`field${full ? ' field-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="switch-track"><span className="switch-dot" /></span>
      <span className="switch-label">{label}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  EMPTY STATE CONSTANTS                                              */
/* ------------------------------------------------------------------ */
const emptyMedicine = {
  name: '',
  manufacturer: '',
  image: '',
  description: '',
  tabletsPerStrip: 10,
  price: '',
  stock: '',
  expiryDate: '',
  prescriptionRequired: false,
}
const emptyNonMed = {
  name: '',
  image: '',
  description: '',
  price: '',
  stock: '',
  expiryDate: '',
}

/* ------------------------------------------------------------------ */
/*  ADD ITEMS                                                          */
/* ------------------------------------------------------------------ */
export default function AddItems({ pushToast, onCreated }) {
  const [kind, setKind] = useState('medicine')
  const [med, setMed] = useState(emptyMedicine)
  const [non, setNon] = useState(emptyNonMed)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)

  const isMed = kind === 'medicine'
  const totalMedicineQuantity =
    (Number(med.stock) || 0) * (Number(med.tabletsPerStrip) || 0)

  const setM = (k) => (e) => setMed((p) => ({ ...p, [k]: e.target.value }))
  const setN = (k) => (e) => setNon((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let imageUrl = isMed ? med.image : non.image
      let cloudinaryPublicId = ''

      if (imageFile) {
        const uploadResult = await uploadToCloudinary(imageFile)
        imageUrl = uploadResult.url
        cloudinaryPublicId = uploadResult.publicId
      }

      if (!imageUrl) throw new Error('Please select an image to upload.')

      if (isMed) {
        const data = await api.post('/medicine', {
          ...med,
          image: imageUrl,
          cloudinaryPublicId,
          tabletsPerStrip: Number(med.tabletsPerStrip) || 1,
          price: Number(med.price) || 0,
          stock: Number(med.stock) || 0,
        })
        pushToast(data.message || 'Medicine uploaded successfully')
        setMed(emptyMedicine)
        setImageFile(null)
        onCreated?.('medicine')
      } else {
        const data = await api.post('/nonmedicinal', {
          ...non,
          image: imageUrl,
          cloudinaryPublicId,
          price: Number(non.price) || 0,
          stock: Number(non.stock) || 0,
        })
        pushToast(data.message || 'Item uploaded successfully')
        setNon(emptyNonMed)
        setImageFile(null)
        onCreated?.('nonMedicinal')
      }
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const previewImage = imageFile
    ? URL.createObjectURL(imageFile)
    : isMed
    ? med.image
    : non.image

  return (
    <div className="stack">
      <div className="segmented-wrap">
        <div className="segmented">
          <span
            className="segmented-thumb"
            style={{ transform: isMed ? 'translateX(0)' : 'translateX(100%)' }}
          />
          <button
            type="button"
            className={isMed ? 'active' : ''}
            onClick={() => setKind('medicine')}
          >
            <Icon name="pill" size={17} /> Medicine
          </button>
          <button
            type="button"
            className={!isMed ? 'active' : ''}
            onClick={() => setKind('nonmedicinal')}
          >
            <Icon name="box" size={17} /> Non-Medicinal
          </button>
        </div>
      </div>

      <div className="split-form">
        <form className="panel form-panel" onSubmit={submit} key={kind}>
          <header className="panel-head">
            <h3>{isMed ? 'Add a medicine' : 'Add a non-medicinal item'}</h3>
            <span className="count-chip">{isMed ? 'Rx / OTC' : 'General'}</span>
          </header>

          <div className="form-grid">
            <Field label="Item name">
              <input
                className="input"
                value={isMed ? med.name : non.name}
                onChange={isMed ? setM('name') : setN('name')}
                placeholder="e.g. Paracetamol 500mg"
                required
              />
            </Field>

            {isMed && (
              <Field label="Manufacturer">
                <input
                  className="input"
                  value={med.manufacturer}
                  onChange={setM('manufacturer')}
                  placeholder="e.g. Cipla Ltd."
                  required
                />
              </Field>
            )}

            <Field label="Product image" full>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <span className="field-hint">
                Cloudinary will generate the image URL automatically and store it in the database.
              </span>
            </Field>

            <Field label="Description" full>
              <textarea
                className="input textarea"
                rows="3"
                value={isMed ? med.description : non.description}
                onChange={isMed ? setM('description') : setN('description')}
                placeholder="Short description shown to customers..."
              />
            </Field>

            {isMed && (
              <Field label="Tablets per strip">
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={med.tabletsPerStrip}
                  onChange={setM('tabletsPerStrip')}
                />
              </Field>
            )}

            <Field label="Price (₹)">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={isMed ? med.price : non.price}
                onChange={isMed ? setM('price') : setN('price')}
                placeholder="0.00"
                required
              />
            </Field>

            <Field label={isMed ? 'Stock (strips)' : 'Stock quantity'}>
              <input
                className="input"
                type="number"
                min="0"
                value={isMed ? med.stock : non.stock}
                onChange={isMed ? setM('stock') : setN('stock')}
                placeholder="0"
                required
              />
            </Field>

            {isMed && (
              <Field label="Total tablets" hint="Calculated from strips × tablets per strip">
                <input
                  className="input"
                  type="number"
                  value={totalMedicineQuantity}
                  readOnly
                />
              </Field>
            )}

            <Field label="Expiry date">
              <input
                className="input"
                type="date"
                value={isMed ? med.expiryDate : non.expiryDate}
                onChange={isMed ? setM('expiryDate') : setN('expiryDate')}
                required={isMed}
              />
            </Field>

            {isMed && (
              <div className="field field-full">
                <Switch
                  checked={med.prescriptionRequired}
                  onChange={(v) => setMed((p) => ({ ...p, prescriptionRequired: v }))}
                  label="Prescription required"
                />
              </div>
            )}
          </div>

          <footer className="form-foot">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => (isMed ? setMed(emptyMedicine) : setNon(emptyNonMed))}
            >
              Reset
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Icon name="plus" size={18} />}
              {saving ? 'Uploading…' : 'Upload item'}
            </button>
          </footer>
        </form>

        <aside className="panel preview-panel">
          <header className="panel-head"><h3>Live preview</h3></header>
          <div className="preview-card">
            <div className="preview-image">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <Icon name={isMed ? 'pill' : 'box'} size={34} />
              )}
            </div>
            <h4>{(isMed ? med.name : non.name) || 'Item name'}</h4>
            <p className="preview-mfr">
              {isMed ? med.manufacturer || 'Manufacturer' : 'Non-medicinal'}
            </p>
            <p className="preview-desc">
              {(isMed ? med.description : non.description) || 'Description will appear here…'}
            </p>
            <div className="preview-meta">
              <span className="price">{money(isMed ? med.price : non.price)}</span>
              <span className="stock-chip">
                {isMed
                  ? `${totalMedicineQuantity.toLocaleString('en-IN')} tablets`
                  : `${Number(non.stock) || 0} in stock`}
              </span>
            </div>
            {isMed && med.prescriptionRequired && <span className="rx-chip">Rx required</span>}
          </div>
        </aside>
      </div>
    </div>
  )
}