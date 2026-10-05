import mongoose, { Document, Model, Schema } from 'mongoose';

export type ClientStatus = 'active' | 'inactive';

export interface IClient extends Document {
  name: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  internalNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    phone: {
      type: String,
      required: false
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    internalNote: {
      type: String,
      required: false,
      default: null,
      maxlength: 280
    }
  },
  {
    timestamps: true
  }
);

ClientSchema.index({ status: 1, createdAt: -1 });

const Client: Model<IClient> = mongoose.model<IClient>('Client', ClientSchema);

export default Client;
