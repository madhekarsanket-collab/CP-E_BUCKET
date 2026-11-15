import { formatDate } from '../../lib/format';

export default function CustomersTab({ customers }) {
  return (
    <div className="card panel">
      <table className="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Born</th><th>Address</th></tr></thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.user_id}>
              <td data-label="ID">#{c.user_id}</td>
              <td data-label="Name"><strong>{c.name}</strong></td>
              <td data-label="Email">{c.email}</td>
              <td data-label="Phone">{c.phone}</td>
              <td data-label="Born">{c.dob ? formatDate(c.dob) : 'Not given'}</td>
              <td data-label="Address">{c.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
