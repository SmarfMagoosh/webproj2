import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';
import { resourceLimits } from 'worker_threads';
import { resolveTlsa } from 'dns';

type DbBook = Lib.Book & { _id: string, patrons: string[] }

export async function makeLibraryDao(dbUrl: string) {
  return await LibraryDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  ignoreUndefined: true,  //ignore undefined fields in queries
};

function extract(value: DbBook): Lib.Book {
  const { _id, patrons, ...book } = value;
  return book as Lib.Book;
}

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
  async createBook(book: Lib.Book): Promise<Errors.Result<DbBook>> {
    try {
      const currBook = await this.books.findOne({ _id: book.isbn });
      const dbook: DbBook = {_id: book.isbn, patrons: [], ...book};
      if (currBook !== null) {
        // if the book was already in the database
        const res = await this.updateBook(book.isbn!, {nCopies: (currBook.nCopies ?? 1) + (book.nCopies ?? 1) });
        if (res.isOk && res.val > 0) {
          return Errors.okResult(dbook);
        } else if (res.isOk && res.val <= 0) {
          return Errors.errResult("Update of nCopies failed");
        } else {
          return Errors.errResult(res);
        }
      } else {
        // if this is the first time inserting
        const res = await this.books.insertOne(dbook);
        return res.acknowledged ? Errors.okResult(dbook) : Errors.errResult("Insert failed");
      }
    } catch(error: any) {
      return Errors.errResult(error.message);
    }
  }

  async getBooks(query: string[], index: number, count: number): Promise<Errors.Result<Lib.Book[]>> {
    const allInConditions = query.map(word => {
      return {
        $or: [
          { title: { $regex: word, $options: "i" } }, 
          { authors: { $regex: word, $options: "i" }}
        ]
    }})

    const param = {$and: allInConditions};
    try {
      let res = this.books.find(param);
      if (index >= 0) {
        res = res.skip(index);
      }
      if (count >= 0) {
        res = res.limit(count);
      }
      const result = await res
        .sort({ title: 1 })
        .toArray()
      return Errors.okResult(result.map(extract));
    } catch(error: any) {
      return Errors.errResult(error.message);
    }
  }

  async updateBook(isbn: string, update: Partial<Lib.Book>): Promise<Errors.Result<number>> {
    try {
      const res = await this.books.updateOne(
        { isbn: isbn },
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
    const q = await this.books.deleteOne({ _id: isbn});
    if (q.acknowledged) {
      return Errors.okResult(q.deletedCount);
    } else {
      return Errors.errResult(-1);
    }
  } 
}


