import { useRef, useState } from "react";
import { generateProductImage } from "../../api";

const CATEGORIES = [
  "Consumer Electronics",
  "Food & Beverage",
  "Apparel & Fashion",
  "Beauty & Personal Care",
  "Home & Living",
  "Health & Wellness",
  "Software / SaaS",
  "Other",
];

const COUNTRIES = [
  { name: "United States", flag: "🇺🇸", currency: "USD", symbol: "$" },
  { name: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "C$" },
  { name: "Mexico", flag: "🇲🇽", currency: "MXN", symbol: "Mex$" },
  { name: "Brazil", flag: "🇧🇷", currency: "BRL", symbol: "R$" },
  { name: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£" },
  { name: "Germany", flag: "🇩🇪", currency: "EUR", symbol: "€" },
  { name: "France", flag: "🇫🇷", currency: "EUR", symbol: "€" },
  { name: "Spain", flag: "🇪🇸", currency: "EUR", symbol: "€" },
  { name: "India", flag: "🇮🇳", currency: "INR", symbol: "₹" },
  { name: "China", flag: "🇨🇳", currency: "CNY", symbol: "¥" },
  { name: "Japan", flag: "🇯🇵", currency: "JPY", symbol: "¥" },
  { name: "South Korea", flag: "🇰🇷", currency: "KRW", symbol: "₩" },
  { name: "UAE", flag: "🇦🇪", currency: "AED", symbol: "د.إ" },
  { name: "Nigeria", flag: "🇳🇬", currency: "NGN", symbol: "₦" },
  { name: "South Africa", flag: "🇿🇦", currency: "ZAR", symbol: "R" },
  { name: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$" },
];

const EMPTY = {
  name: "",
  description: "",
  country: "United States",
  currency: "INR",
  category: CATEGORIES[0],
  price: "",
  targetCustomer: "",
  productMedia: null,
};

export default function InputForm({ initialValue, onSubmit }) {
  const [form, setForm] = useState(initialValue || EMPTY);

  const [mediaPreview, setMediaPreview] = useState(
    initialValue?.productMedia || null
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef(null);

  const update = (key) => (e) => {
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));
  };

  const isValid =
    form.name.trim() &&
    form.description.trim() &&
    form.price !== "" &&
    form.targetCustomer.trim();

  const selectedCountry =
    COUNTRIES.find((country) => country.name === form.country) ||
    COUNTRIES[0];

  const handleCountryChange = (e) => {
    const countryName = e.target.value;

    const selected = COUNTRIES.find(
      (country) => country.name === countryName
    );

    if (!selected) return;

    setForm((f) => ({
      ...f,
      country: selected.name,
      currency: selected.currency,
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);

    const media = {
      type: file.type.startsWith("video") ? "video" : "image",
      url,
      name: file.name,
    };

    setMediaPreview(media);

    setForm((f) => ({
      ...f,
      productMedia: media,
    }));
  };

  const removeMedia = () => {
    setMediaPreview(null);

    setForm((f) => ({
      ...f,
      productMedia: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const generateAIImage = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      alert("Please enter the product name and description first.");
      return;
    }

    setIsGenerating(true);

    try {
      const media = await generateProductImage({
        name: form.name,
        description: form.description,
        category: form.category,
      });

      setMediaPreview(media);

      setForm((f) => ({
        ...f,
        productMedia: media,
      }));
    } catch (error) {
      alert(error.message || "Unable to generate product image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isValid) return;

    onSubmit({
      ...form,
      price: parseFloat(form.price),
    });
  };

  return (
    <form className="panel" onSubmit={handleSubmit}>

      {/* PRODUCT NAME */}
      <div className="field">
        <label htmlFor="name">Product name</label>

        <input
          id="name"
          type="text"
          placeholder="e.g. Aurora Smart Water Bottle"
          value={form.name}
          onChange={update("name")}
        />
      </div>


      {/* DESCRIPTION */}
      <div className="field">
        <label htmlFor="description">Description</label>

        <textarea
          id="description"
          rows={4}
          placeholder="What does it do, and what makes it different?"
          value={form.description}
          onChange={update("description")}
        />
      </div>


      {/* PRODUCT MEDIA */}
      <div className="field product-media-field">

        <label>Product media</label>

        <span className="hint">
          Upload an existing product image/video or generate a visual with AI.
        </span>

        <div className="media-actions">

          {/* UPLOAD */}
          <button
            type="button"
            className="media-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="media-icon">↑</span>

            <div>
              <strong>Upload product media</strong>

              <small>
                Image or video from your device
              </small>
            </div>
          </button>


          {/* AI GENERATE */}
          <button
            type="button"
            className="media-ai-btn"
            onClick={generateAIImage}
            disabled={isGenerating}
          >
            <span className="media-icon">✦</span>

            <div>
              <strong>
                {isGenerating
                  ? "Generating..."
                  : "Generate with AI"}
              </strong>

              <small>
                Create a product visual from your description
              </small>
            </div>
          </button>

        </div>


        {/* HIDDEN FILE INPUT */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />


        {/* PREVIEW */}
        {mediaPreview && (
          <div className="media-preview">

            {mediaPreview.type === "video" ? (
              <video
                src={mediaPreview.url}
                controls
              />
            ) : (
              <img
                src={mediaPreview.url}
                alt="Product preview"
              />
            )}

            <div className="media-preview-info">

              <span>
                {mediaPreview.name || "Product media"}
              </span>

              <button
                type="button"
                className="media-remove"
                onClick={removeMedia}
              >
                Remove
              </button>

            </div>

          </div>
        )}

      </div>


      {/* COUNTRY + CURRENCY */}
      <div className="field-row">

        {/* COUNTRY */}
        <div className="field">

          <label htmlFor="country">
            Country
          </label>

          <select
            id="country"
            value={form.country}
            onChange={handleCountryChange}
          >
            {COUNTRIES.map((country) => (
              <option
                key={country.name}
                value={country.name}
              >
                {country.flag} {country.name}
              </option>
            ))}
          </select>

        </div>


        {/* CURRENCY */}
        <div className="field">

          <label htmlFor="currency">
            Currency
          </label>

          <select
            id="currency"
            value={form.currency}
            onChange={update("currency")}
          >
            {[...new Set(COUNTRIES.map((c) => c.currency))].map(
              (currency) => (
                <option
                  key={currency}
                  value={currency}
                >
                  {currency}
                </option>
              )
            )}
          </select>

          <span className="hint">
            {selectedCountry.symbol}
          </span>

        </div>

      </div>


      {/* CATEGORY + PRICE */}
      <div className="field-row">

        {/* CATEGORY */}
        <div className="field">

          <label htmlFor="category">
            Category
          </label>

          <select
            id="category"
            value={form.category}
            onChange={update("category")}
          >
            {CATEGORIES.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>

        </div>


        {/* PRICE */}
        <div className="field">

          <label htmlFor="price">
            Price ({form.currency})
          </label>

          <div
            style={{
              position: "relative",
              width: "100%",
            }}
          >

            <span
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-dim)",
                pointerEvents: "none",
                fontSize: "15px",
                zIndex: 1,
              }}
            >
              {selectedCountry.symbol}
            </span>

            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="499"
              value={form.price}
              onChange={update("price")}
              style={{
                paddingLeft: "42px",
              }}
            />

          </div>

        </div>

      </div>


      {/* TARGET CUSTOMER */}
      <div className="field">

        <label htmlFor="target">
          Target customer
        </label>

        <input
          id="target"
          type="text"
          placeholder="e.g. Urban professionals, 25–40, health-conscious"
          value={form.targetCustomer}
          onChange={update("targetCustomer")}
        />

        <span className="hint">
          A quick sketch of who this is built for — personas are generated
          from this.
        </span>

      </div>


      {/* SUBMIT */}
      <div className="actions-row">

        <span />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!isValid}
        >
          Choose markets →
        </button>

      </div>

    </form>
  );
}