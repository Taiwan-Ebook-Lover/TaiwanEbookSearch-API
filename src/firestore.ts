import admin, { ServiceAccount } from 'firebase-admin';
import { Bookstore } from './interfaces/bookstore';
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

export const getBookstores = (bookstoreId?: string): Promise<Bookstore[]> => {
  const bookstores: Bookstore[] = [];
  let bookstoreRef: FirebaseFirestore.Query;
  if (bookstoreId)
    bookstoreRef = firestore
      .collection('bookstores')
      .where('id', '==', bookstoreId);
  else bookstoreRef = firestore.collection('bookstores');

  return bookstoreRef.get()
    .then((snapshot: FirebaseFirestore.QuerySnapshot) => {
      if (snapshot.empty) {
        throw Error('No matching bookstore.');
      }
      for (const bookstore of snapshot.docs) {
        const bookstoreData = bookstore.data();
        bookstores.push({
          id: bookstoreData.id,
          displayName: bookstoreData.displayName,
          website: bookstoreData.website,
          isOkay: bookstoreData.isOkay,
          status: bookstoreData.status,
        });
      }
      return bookstores;
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);
      return bookstores;
    });
}; 

export const insertSearch = async (data: AnyObject<any>) => {
  console.log(data);
  const res = await firestore.collection('searches').add(data);
  console.log('Added document with ID: ', res.id);
  return res.id;
};

export const getSearch = async (id?: string) => {};
