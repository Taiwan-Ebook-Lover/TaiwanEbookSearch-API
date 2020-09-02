import admin, { ServiceAccount } from 'firebase-admin';
import { FirestoreBookstore } from './interfaces/firebaseBookstore';
import { AnyObject } from './interfaces/general';

export let firestore: FirebaseFirestore.Firestore;

export const connect = (url: string, serviceAccount: ServiceAccount): Promise<void> => {
  return new Promise<FirebaseFirestore.Firestore>((resolve, reject) => {
    // check firestore connected status
    if (firestore) {
      reject('DB is already connected.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: url,
      });
      resolve(admin.firestore());
    }
  })
    .then((connection: FirebaseFirestore.Firestore) => {
      // update firestore
      firestore = connection;
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);
    });
};

export const getBookstores = (bookstoreId?: string): Promise<FirestoreBookstore[]> => {
  const bookstores: FirestoreBookstore[] = [];
  let bookstoreRef: FirebaseFirestore.Query;

  if (bookstoreId) {
    bookstoreRef = firestore.collection('bookstores').where('id', '==', bookstoreId);
  } else {
    bookstoreRef = firestore.collection('bookstores');
  }

  return bookstoreRef
    .get()
    .then((snapshot: FirebaseFirestore.QuerySnapshot) => {
      if (snapshot.empty) {
        throw Error('No matching bookstore.');
      }
      for (const bookstore of snapshot.docs) {
        const bookstoreData = bookstore.data() as FirestoreBookstore;
        bookstores.push(bookstoreData);
      }
      return bookstores;
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);
      return bookstores;
    });
};

export const insertSearch = (data: AnyObject<any>): Promise<any> => {
  const formattedData = JSON.parse(
    JSON.stringify(data, (key, value) => (value === undefined ? null : value))
  );
  return firestore
    .collection('searches')
    .add(formattedData)
    .then(({ id }) => ({ ...formattedData, id }))
    .catch(error => {
      console.time('Error time: ');
      console.error(error);
      return '';
    });
};

export const getSearch = (id: string): Promise<AnyObject<any>> => {
  return firestore
    .collection('searches')
    .doc(id)
    .get()
    .then(doc => {
      if (!doc.exists) {
        throw Error('No matching bookstore.');
      }
      return { ...doc.data(), id };
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);
      return {};
    });
};
