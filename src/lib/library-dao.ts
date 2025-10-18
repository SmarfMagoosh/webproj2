import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';
import { resourceLimits } from 'worker_threads';

type DbBook = Lib.Book & { _id: string }

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
  private books: mongo.Collection<DbBook>;

  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(
    client: mongo.MongoClient, 
    db: mongo.Db,
    books: mongo.Collection<DbBook>
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
      const books = db.collection<DbBook>("books");

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
      const res = await this.books.insertOne({ _id: book.isbn, ...book });
      return res.acknowledged ? Errors.okResult(book) : Errors.errResult("Insert failed");
    } catch(error: any) {
      return Errors.errResult(error.message);
    }
  }

  async readBook(isbn: string): Promise<Errors.Result<Lib.Book>> {
    try {
      const res = await this.books.findOne({_id: isbn});
      return res ? Errors.okResult(res) : Errors.errResult(`No book for isbn ${isbn}`, {code: "NOT_FOUND"})
    } catch(error: any) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  async updateBook(isbn: string, update: Partial<Lib.Book>): Promise<Errors.Result<number>> {
    try {
      const res = await this.books.updateOne(
        { _id: isbn },
        { $set: update }
      );

      return res.matchedCount === 0 
        ? Errors.errResult(`No book found with isbn ${isbn}`, "DB")
        : Errors.okResult(res.modifiedCount);  
    } catch(error: any) {
      return Errors.errResult(error.message, "DB");
    }
  }

  async deleteBook(isbn: string): Promise<Errors.Result<number>> {
    try {
      const res = await this.books.deleteOne({ _id: isbn});
      return Errors.okResult(res.deletedCount ?? 0);
    } catch(error: any) {
      return Errors.errResult(`No book found with isbn ${isbn}`, "DB");
    }
  } 
}


