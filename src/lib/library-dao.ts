import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';

//TODO: define any DB specific types if necessary

export async function makeLibraryDao(dbUrl: string) {
  return await LibraryDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  ignoreUndefined: true,  //ignore undefined fields in queries
};

export class LibraryDao {
  private client: mongo.MongoClient;
  private db: mongo.Db;
  private books: mongo.Collection<Lib.Book>;

  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(
    client: mongo.MongoClient, 
    db: mongo.Db,
    books: mongo.Collection<Lib.Book>
  ) {
    this.client = client,
    this.db = db
    this.books = books
  }

  //static factory function; should do all async operations like
  //getting a connection and creating indexing.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make(dbUrl: string) : Promise<Errors.Result<LibraryDao>> {
    try {
      // connect
      const client = new mongo.MongoClient(dbUrl, MONGO_OPTIONS);
      await client.connect();

      // select database
      const db = client.db("library");
      const books = db.collection<Lib.Book>("books");

      return Errors.okResult(new LibraryDao(client, db, books));
    }
    catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  /** close off this DAO; implementing object is invalid after 
   *  call to close() 
   *
   *  Error Codes: 
   *    DB: a database error was encountered.
   */
  async close() : Promise<Errors.Result<void>> {
    try {
      await this.client.close();
      return Errors.okResult(undefined);
    } catch (error: any) {
      return Errors.errResult(error.message, "DB");
    }
  }
  
  // CRUD
  async createBook(book: Lib.Book): Promise<Errors.Result<Lib.Book>> {
    try {
      const res = await this.books.insertOne(book);
      return res.acknowledged ? Errors.okResult(book) : Errors.errResult("Insert failed");
    } catch(error: any) {
      return Errors.errResult(error.message);
    }
  }

  async readBook(isbn: string): Promise<Errors.Result<Lib.Book>> {
    try {
      
    } catch(error: any) {
      
    }
    return null;
  }

  async updateBook(isbn: string, update: Lib.Book): Promise<Errors.Result<Lib.Book>> {
    try {
      
    } catch(error: any) {
      
    }
    return null;
  }

  async deleteBook(isbn: string): Promise<Errors.Result<Lib.Book>> {
    try {
      
    } catch(error: any) {
      
    }
    return null;
  } 
}


