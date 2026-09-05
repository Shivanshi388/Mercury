import { useState } from 'react';
import { MARKETS } from './markets';

const CATEGORIES = [
  'Consumer Electronics',
  'Food & Beverage',
  'Apparel & Fashion',
  'Beauty & Personal Care',
  'Home & Living',
  'Health & Wellness',
  'Software / SaaS',
  'Other',
];

const EMPTY = {
  name: '',
  description: '',
  category: CATEGORIES[0],
  price: '',
  targetCustomer: '',
  country: 'IN',
  currency: 'INR',
};

export default function InputForm({ initialValue, onSubmit }) {
  const [form, setForm] = useState(initialValue || EMPTY);

  // Find the currently selected country
  const selectedMarket =
    MARKETS.find((market) => market.code === form.country) || MARKETS[0];

  // Update normal fields
  const update = (key) => (e) => {
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));
  };

  // When country changes, automatically change the currency
  const handleCountryChange = (e) => {
    const countryCode = e.target.value;

    const market =
      MARKETS.find((item) => item.code === countryCode) || MARKETS[0];

    setForm((f) => ({
      ...f,
      country: market.code,
      currency: market.currency,
    }));
  };

  const isValid =
    form.name.trim() &&
    form.description.trim() &&
    form.price !== '' &&
    form.targetCustomer.trim() &&
    form.country;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isValid) return;

    onSubmit({
      ...form,
      price: parseFloat(form.price),
      country: form.country,
      currency: selectedMarket.currency,
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
          onChange={update('name')}
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
          onChange={update('description')}
        />
      </div>


      {/* COUNTRY / CATEGORY / PRICE */}
      <div className="field-row">

        {/* COUNTRY */}
        <div className="field">
          <label htmlFor="country">Country</label>

          <select
            id="country"
            value={form.country || 'IN'}
            onChange={handleCountryChange}
          >
            {MARKETS.map((market) => (
              <option key={market.code} value={market.code}>
                {market.flag} {market.name}
              </option>
            ))}
          </select>

          <span className="hint">
            Currency: {selectedMarket.currency} ΓÇö {selectedMarket.symbol}
          </span>
        </div>


        {/* CATEGORY */}
        <div className="field">
          <label htmlFor="category">Category</label>

          <select
            id="category"
            value={form.category}
            onChange={update('category')}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>


        {/* PRICE */}
        <div className="field">
          <label htmlFor="price">
            Price ({selectedMarket.currency})
          </label>

          <div className="price-input-wrapper">
            <span className="currency-symbol">
              {selectedMarket.symbol}
            </span>

            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="999"
              value={form.price}
              onChange={update('price')}
            />
          </div>
        </div>

      </div>


      {/* TARGET CUSTOMER */}
      <div className="field">
        <label htmlFor="target">Target customer</label>

        <input
          id="target"
          type="text"
          placeholder="e.g. Urban professionals, 25ΓÇô40, health-conscious"
          value={form.targetCustomer}
          onChange={update('targetCustomer')}
        />

        <span className="hint">
          A quick sketch of who this is built for ΓÇö personas are generated
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
          Choose markets ΓåÆ
        </button>
      </div>

    </form>
  );
}
