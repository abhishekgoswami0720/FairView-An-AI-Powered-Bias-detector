const mongoose = require('mongoose');
const { Schema } = mongoose;

// A project is created by a client and handled by one manager.
// Status flow: open -> delivered (manager hands it over) -> rated (client rates it)
const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    // immutable: once set, the client and manager of a project can never be swapped.
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    status: { type: String, enum: ['open', 'delivered', 'rated'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
