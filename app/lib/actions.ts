'use server';

import{ z } from 'zod';
import { revalidatePath } from 'next/cache';
import postgres from 'postgres';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id:z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['paid', 'pending'], { invalid_type_error: 'Please select an invoice status',
    }),
    date: z.string(),
})

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
}

const sql = postgres(process.env.POSTGRES_URL!, {ssl: 'require'} )
const CreateInvoice = FormSchema.omit({ id: true, date: true});


export async function createInvoice(prevState: State, formData: FormData){

    // Validate form using Zod
    const validatedFiels = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFiels.success) {
        return {
            errors: validatedFiels.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to create invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFiels.data;    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

     // Insert data into the database
    try {
        await sql `INSERT INTO invoices (customer_id, amount, status, date) VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;
    } catch (error) {
        // If a database error occurs, return a more specific error.
        return { message: 'Database Error: Failed to create invoice.' };
    }
    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}


const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice( id: string, prevState: State,formData: FormData) {
    const validatedFiels = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFiels.success) {
        return {
            errors: validatedFiels.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to update invoice.',
        };
    }

    const { customerId, amount, status } = validatedFiels.data;
    const amountInCents = amount * 100;

    try {
        await sql `UPDATE invoices SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status} WHERE id = ${id}`;
    }catch (error) {
        return { message: 'Database Error: Failed to update invoice.' };
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}


export async function deleteInvoice(id: string) {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}

