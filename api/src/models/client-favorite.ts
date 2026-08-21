import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IClientFavorite extends Document {
  userId: Types.ObjectId;
  clientId: Types.ObjectId;
  createdAt: Date;
}

const ClientFavoriteSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// RN-01: idempotencia del toggle a nivel de datos, no solo en el service.
ClientFavoriteSchema.index({ userId: 1, clientId: 1 }, { unique: true });

const ClientFavorite: Model<IClientFavorite> = mongoose.model<IClientFavorite>(
  'ClientFavorite',
  ClientFavoriteSchema
);

export default ClientFavorite;
