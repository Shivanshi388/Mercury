import { useState } from "react";

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

const EMPTY = {
  name: "",
  description: "",
  category: CATEGORIES[0],
  price: "",
  targetCustomer: "",
};

export default function InputForm({ initialValue, onSubmit }) {
  const [form, setForm] = useState(initialValue || EMPTY);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const isValid =
    form.name.trim() &&
    form.description.trim() &&
    form.price !== "" &&
    form.targetCustomer.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({ ...form, price: parseFloat(form.price) });
  };

  return (
    <form className="panel" onSubmit={handleSubmit}>
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

      <div className="field-row">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={form.category}
            onChange={update("category")}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="price">Price (USD)</label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="49.99"
            value={form.price}
            onChange={update("price")}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="target">Target customer</label>
        <input
          id="target"
          type="text"
          placeholder="e.g. Urban professionals, 25–40, health-conscious"
          value={form.targetCustomer}
          onChange={update("targetCustomer")}
        />
        <span className="hint">
          A quick sketch of who this is built for — personas are generated from
          this.
        </span>
      </div>

      <div className="actions-row">
        <span />
        <button type="submit" className="btn btn-primary" disabled={!isValid}>
          Choose markets →
        </button>
      </div>
    </form>
  );
}
