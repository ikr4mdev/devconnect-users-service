const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const protoPath = path.resolve(
  'node_modules/@devconnect-microservices/devconnect-contracts/proto/users/v1/users.proto',
);

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

const UsersService = proto.users.v1.UsersService;

const client = new UsersService(
  'localhost:5002',
  grpc.credentials.createInsecure(),
);

console.log('Top-level keys:', Object.keys(proto));
console.log('gRPC client created');

client.getProfileByUserId(
  { userId: 'af58fbcd-e98b-43f8-8172-4c2d3f8f5823' },
  (error, response) => {
    if (error) {
      console.error('gRPC error:', error);
      client.close();
      return;
    }

    console.log('Profile response:', response);
    client.close();
  },
);
